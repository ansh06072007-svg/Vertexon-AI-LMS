import { Router } from 'express';
import { db, now, recordAudit } from '../db.mjs';
import { authRequired, roleRequired } from '../auth.mjs';

const router = Router();
router.use(authRequired, roleRequired('admin'));

router.get('/overview', (_req, res) => {
  const count = (sql, ...params) => Number(db.prepare(sql).get(...params).count);
  const revenue = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'success'").get();
  const avgProgress = db.prepare('SELECT COALESCE(AVG(progress_percent), 0) AS average FROM enrollments').get();
  const today = new Date().toISOString().slice(0, 10);
  const pendingCourses = db
    .prepare(
      `SELECT c.*, u.full_name AS instructor_name,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count
       FROM courses c JOIN users u ON u.id = c.instructor_id WHERE c.status = 'pending' ORDER BY c.created_at DESC`,
    )
    .all();
  const recentUsers = db
    .prepare(
      `SELECT id, full_name, email, role, status, headline, created_at FROM users ORDER BY created_at DESC LIMIT 6`,
    )
    .all();
  const flagged = db
    .prepare(
      `SELECT p.*, u.full_name AS author_name, t.title AS thread_title, c.title AS course_title
       FROM discussion_posts p JOIN users u ON u.id = p.user_id
       JOIN discussion_threads t ON t.id = p.thread_id JOIN courses c ON c.id = t.course_id
       WHERE p.is_flagged = 1 ORDER BY p.created_at DESC`,
    )
    .all();
  const auditLogs = db
    .prepare(
      `SELECT al.*, u.full_name AS actor_name FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id
       ORDER BY al.created_at DESC LIMIT 12`,
    )
    .all();

  res.json({
    stats: {
      total_users: count('SELECT COUNT(*) AS count FROM users'),
      active_students: count("SELECT COUNT(*) AS count FROM users WHERE role = 'student' AND status = 'active'"),
      instructors: count("SELECT COUNT(*) AS count FROM users WHERE role = 'instructor'"),
      suspended_users: count("SELECT COUNT(*) AS count FROM users WHERE status = 'suspended'"),
      total_courses: count('SELECT COUNT(*) AS count FROM courses'),
      approved_courses: count("SELECT COUNT(*) AS count FROM courses WHERE status = 'approved'"),
      pending_courses: pendingCourses.length,
      enrollments: count('SELECT COUNT(*) AS count FROM enrollments'),
      completion_rate: Math.round(Number(avgProgress.average)),
      revenue: Number(revenue.total),
      flagged_posts: flagged.length,
      active_today: count('SELECT COUNT(*) AS count FROM streaks WHERE last_active_date = ?', today),
      quiz_attempts: count('SELECT COUNT(*) AS count FROM quiz_attempts WHERE submitted_at IS NOT NULL'),
    },
    pending_courses: pendingCourses,
    recent_users: recentUsers,
    flagged_posts: flagged,
    audit_logs: auditLogs,
  });
});

router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim();
  const role = String(req.query.role || '').trim();
  const status = String(req.query.status || '').trim();
  const clauses = [];
  const params = [];
  if (q) {
    clauses.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (role) {
    clauses.push('u.role = ?');
    params.push(role);
  }
  if (status) {
    clauses.push('u.status = ?');
    params.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const users = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.role, u.status, u.headline, u.created_at,
              s.current_streak, s.last_active_date,
              (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enrollment_count,
              (SELECT COUNT(*) FROM courses c WHERE c.instructor_id = u.id) AS course_count
       FROM users u LEFT JOIN streaks s ON s.user_id = u.id ${where}
       ORDER BY u.created_at DESC`,
    )
    .all(...params);
  res.json({ users });
});

router.put('/users/:id/role', (req, res) => {
  const role = String(req.body.role || '');
  if (!['student', 'instructor', 'admin'].includes(role)) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Role must be student, instructor, or admin.' } });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
  if (user.id === req.user.id && role !== 'admin') {
    return res.status(422).json({ error: { code: 'SELF_ROLE_CHANGE', message: 'You cannot remove your own admin role.' } });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
  db.prepare('INSERT INTO notifications (id, user_id, title, body, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(
    `notif-${crypto.randomUUID()}`,
    user.id,
    'Account role updated',
    `Your platform role is now ${role}.`,
    now(),
  );
  recordAudit(req.user.id, 'user.role_changed', 'user', user.id, { from: user.role, to: role });
  res.json({ user: { ...user, role } });
});

router.put('/users/:id/suspend', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
  if (user.id === req.user.id) {
    return res.status(422).json({ error: { code: 'SELF_SUSPEND', message: 'You cannot suspend your own account.' } });
  }
  const status = req.body.suspended ? 'suspended' : 'active';
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, user.id);
  if (status === 'suspended') {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
  }
  recordAudit(req.user.id, status === 'suspended' ? 'user.suspended' : 'user.reactivated', 'user', user.id, {});
  res.json({ user: { ...user, status } });
});

router.delete('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
  if (user.id === req.user.id) {
    return res.status(422).json({ error: { code: 'SELF_DELETE', message: 'You cannot delete your own account.' } });
  }
  if (user.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'").get();
    if (Number(admins.count) <= 1) {
      return res.status(422).json({ error: { code: 'LAST_ADMIN', message: 'The final active admin cannot be deleted.' } });
    }
  }
  if (user.status === 'deleted') return res.json({ deleted: true, anonymized: true });
  const placeholderEmail = `deleted-${user.id}@vertexon.invalid`;
  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE users SET full_name = 'Deleted user', email = ?, password_hash = ?, status = 'deleted',
       headline = NULL, avatar_url = NULL WHERE id = ?`,
    ).run(placeholderEmail, crypto.randomUUID(), user.id);
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM email_outbox WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM bookmarks WHERE user_id = ?').run(user.id);
    db.prepare(
      "UPDATE discussion_posts SET content = '[removed on account deletion]', is_flagged = 0 WHERE user_id = ?",
    ).run(user.id);
    db.prepare('DELETE FROM ai_chat_sessions WHERE user_id = ?').run(user.id);
    recordAudit(req.user.id, 'user.deleted', 'user', user.id, { previous_role: user.role });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  res.json({ deleted: true, anonymized: true });
});

router.get('/email-outbox', (_req, res) => {
  const messages = db
    .prepare('SELECT * FROM email_outbox ORDER BY created_at DESC LIMIT 100')
    .all();
  res.json({ messages, adapter: 'local-outbox' });
});

router.get('/courses', (req, res) => {
  const status = String(req.query.status || '').trim();
  const courses = db
    .prepare(
      `SELECT c.*, u.full_name AS instructor_name,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS learner_count,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count
       FROM courses c JOIN users u ON u.id = c.instructor_id
       ${status ? 'WHERE c.status = ?' : ''} ORDER BY c.created_at DESC`,
    )
    .all(...(status ? [status] : []));
  res.json({ courses });
});

router.get('/courses/pending', (_req, res) => {
  const courses = db
    .prepare(
      `SELECT c.*, u.full_name AS instructor_name,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count
       FROM courses c JOIN users u ON u.id = c.instructor_id WHERE c.status = 'pending' ORDER BY c.created_at DESC`,
    )
    .all();
  res.json({ courses });
});

router.get('/moderation/flagged', (_req, res) => {
  const posts = db
    .prepare(
      `SELECT p.*, u.full_name AS author_name, u.email AS author_email,
              t.id AS thread_id, t.title AS thread_title, c.id AS course_id, c.title AS course_title
       FROM discussion_posts p JOIN users u ON u.id = p.user_id
       JOIN discussion_threads t ON t.id = p.thread_id JOIN courses c ON c.id = t.course_id
       WHERE p.is_flagged = 1 ORDER BY p.created_at DESC`,
    )
    .all();
  res.json({ posts });
});

router.put('/moderation/posts/:id', (req, res) => {
  const action = String(req.body.action || 'dismiss');
  if (!['dismiss', 'remove'].includes(action)) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Action must be dismiss or remove.' } });
  }
  const post = db.prepare('SELECT * FROM discussion_posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post not found.' } });
  if (action === 'remove') {
    db.prepare('DELETE FROM discussion_posts WHERE id = ?').run(post.id);
  } else {
    db.prepare('UPDATE discussion_posts SET is_flagged = 0 WHERE id = ?').run(post.id);
  }
  recordAudit(req.user.id, `moderation.${action}`, 'discussion_post', post.id, {});
  res.json({ ok: true, action });
});

router.get('/audit-logs', (_req, res) => {
  const logs = db
    .prepare(
      `SELECT al.*, u.full_name AS actor_name FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id
       ORDER BY al.created_at DESC LIMIT 100`,
    )
    .all();
  res.json({ logs: logs.map((log) => ({ ...log, metadata: safeJson(log.metadata, {}) })) });
});

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export default router;
