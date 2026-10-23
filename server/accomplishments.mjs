import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, db, id, now, recordAudit } from './db.mjs';

const outboxLog = process.env.MAIL_OUTBOX_LOG || join(dataDir, 'mail-outbox.log');

/**
 * Local delivery adapter for the email channel. In a deployed environment this
 * function is the seam where an SMTP / SES provider would be called. For the
 * zero-Docker demo every message is also persisted in `email_outbox` and the
 * JSONL file at server/data/mail-outbox.log so delivery can be inspected.
 */
export function queueEmail(userId, subject, body) {
  const user = db.prepare('SELECT id, email, full_name FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  const createdAt = now();
  const email = {
    id: id('email'),
    user_id: user.id,
    recipient: user.email,
    subject: String(subject || 'Vertexon update'),
    body: String(body || ''),
    status: 'delivered',
    created_at: createdAt,
    sent_at: createdAt,
  };
  db.prepare(
    'INSERT INTO email_outbox (id, user_id, recipient, subject, body, status, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    email.id,
    email.user_id,
    email.recipient,
    email.subject,
    email.body,
    email.status,
    email.created_at,
    email.sent_at,
  );
  try {
    appendFileSync(
      outboxLog,
      `${JSON.stringify({ ...email, to: user.full_name })}\n`,
      'utf8',
    );
  } catch {
    // File logging is best effort; the database outbox remains the source of truth.
  }
  return email;
}

export function notifyUser(userId, title, body, { email = false, emailSubject } = {}) {
  const notification = {
    id: id('notif'),
    user_id: userId,
    title: String(title),
    body: String(body || ''),
    is_read: 0,
    created_at: now(),
  };
  db.prepare(
    'INSERT INTO notifications (id, user_id, title, body, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)',
  ).run(notification.id, notification.user_id, notification.title, notification.body, notification.created_at);
  if (email) queueEmail(userId, emailSubject || notification.title, notification.body);
  return notification;
}

export function awardBadge(userId, badgeId, { notify = true } = {}) {
  const badge = db.prepare('SELECT * FROM badges WHERE id = ?').get(badgeId);
  if (!badge) return null;
  const earnedAt = now();
  const result = db
    .prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)')
    .run(userId, badge.id, earnedAt);
  if (Number(result.changes) > 0 && notify) {
    notifyUser(userId, `Badge unlocked · ${badge.name}`, badge.description || 'A new learning milestone is complete.', {
      email: true,
      emailSubject: `You unlocked the ${badge.name} badge`,
    });
  }
  return Number(result.changes) > 0 ? { ...badge, earned_at: earnedAt } : null;
}

export function issueCertificate(userId, courseId) {
  const enrollment = db
    .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(userId, courseId);
  if (!enrollment || Number(enrollment.progress_percent) < 100) return null;
  const existing = db
    .prepare('SELECT * FROM certificates WHERE user_id = ? AND course_id = ?')
    .get(userId, courseId);
  if (existing) return { certificate: existing, already_issued: true };
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return null;
  const credential = `VX-${(course.glyph || 'LMS').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() || 'LMS'}-${Math.floor(1000 + Math.random() * 9000)}`;
  const certificate = {
    id: id('certificate'),
    user_id: userId,
    course_id: courseId,
    certificate_url: null,
    credential_id: credential,
    issued_at: now(),
  };
  db.prepare(
    'INSERT INTO certificates (id, user_id, course_id, certificate_url, credential_id, issued_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    certificate.id,
    certificate.user_id,
    certificate.course_id,
    certificate.certificate_url,
    certificate.credential_id,
    certificate.issued_at,
  );
  certificate.certificate_url = `/api/v1/certificates/${certificate.id}/download`;
  db.prepare('UPDATE certificates SET certificate_url = ? WHERE id = ?').run(
    certificate.certificate_url,
    certificate.id,
  );
  notifyUser(
    userId,
    'Certificate ready',
    `Your certificate for ${course.title} is ready to download. Credential ${credential}.`,
    { email: true, emailSubject: `Your Vertexon certificate for ${course.title}` },
  );
  recordAudit(userId, 'certificate.issued', 'course', courseId, { credential, automatic: true });
  return { certificate: { ...certificate, course_title: course.title }, already_issued: false };
}

export function syncCourseCompletion(userId, courseId) {
  const enrollment = db
    .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(userId, courseId);
  if (!enrollment || Number(enrollment.progress_percent) < 100) return { certificate: null, badges: [] };
  const result = issueCertificate(userId, courseId);
  const badges = [];
  const first = awardBadge(userId, 'b-first');
  if (first) badges.push(first);
  return { certificate: result?.certificate || null, badges };
}

export function touchStreak(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId);
  if (!streak) {
    db.prepare(
      'INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date) VALUES (?, 1, 1, ?)',
    ).run(userId, today);
    return { current_streak: 1, longest_streak: 1, last_active_date: today, incremented: true };
  }
  if (streak.last_active_date === today) return { ...streak, incremented: false };
  const next = streak.last_active_date === yesterday ? Number(streak.current_streak) + 1 : 1;
  const longest = Math.max(Number(streak.longest_streak), next);
  db.prepare(
    'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_active_date = ? WHERE user_id = ?',
  ).run(next, longest, today, userId);
  if (next >= 7) awardBadge(userId, 'b-streak');
  return { current_streak: next, longest_streak: longest, last_active_date: today, incremented: true };
}

export function recordQuizMastery(userId, courseId, topic, score) {
  const normalized = String(topic || 'Course practice').trim() || 'Course practice';
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const existing = db
    .prepare('SELECT * FROM topic_mastery WHERE user_id = ? AND course_id = ? AND topic = ?')
    .get(userId, courseId, normalized);
  const updatedAt = now();
  if (existing) {
    const nextMastery = Math.round(Number(existing.mastery) * 0.65 + value * 0.35);
    db.prepare(
      'UPDATE topic_mastery SET mastery = ?, attempts_count = attempts_count + 1, updated_at = ? WHERE id = ?',
    ).run(nextMastery, updatedAt, existing.id);
    return { ...existing, mastery: nextMastery, attempts_count: Number(existing.attempts_count) + 1, updated_at: updatedAt };
  }
  const row = {
    id: id('mastery'),
    user_id: userId,
    course_id: courseId,
    topic: normalized,
    mastery: value,
    attempts_count: 1,
    updated_at: updatedAt,
  };
  db.prepare(
    'INSERT INTO topic_mastery (id, user_id, course_id, topic, mastery, attempts_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(row.id, row.user_id, row.course_id, row.topic, row.mastery, row.attempts_count, row.updated_at);
  return row;
}

export function getMastery(userId, courseId = null) {
  const rows = courseId
    ? db
        .prepare(
          `SELECT tm.*, c.title AS course_title FROM topic_mastery tm JOIN courses c ON c.id = tm.course_id
           WHERE tm.user_id = ? AND tm.course_id = ? ORDER BY tm.mastery ASC`,
        )
        .all(userId, courseId)
    : db
        .prepare(
          `SELECT tm.*, c.title AS course_title FROM topic_mastery tm JOIN courses c ON c.id = tm.course_id
           WHERE tm.user_id = ? ORDER BY tm.mastery ASC`,
        )
        .all(userId);
  return rows.map((row) => ({
    ...row,
    mastery: Number(row.mastery),
    attempts_count: Number(row.attempts_count),
    status: Number(row.mastery) >= 80 ? 'strong' : Number(row.mastery) >= 55 ? 'developing' : 'needs_review',
  }));
}
