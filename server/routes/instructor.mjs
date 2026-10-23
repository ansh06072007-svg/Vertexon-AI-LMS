import { Router } from 'express';
import { db, now, recordAudit } from '../db.mjs';
import { authRequired, roleRequired } from '../auth.mjs';

const router = Router();
router.use(authRequired, roleRequired('instructor', 'admin'));

function ownCourses(user) {
  if (user.role === 'admin') return db.prepare('SELECT * FROM courses ORDER BY created_at DESC').all();
  return db.prepare('SELECT * FROM courses WHERE instructor_id = ? ORDER BY created_at DESC').all(user.id);
}

function courseStats(courseId) {
  const learners = db.prepare('SELECT COUNT(*) AS count FROM enrollments WHERE course_id = ?').get(courseId);
  const avg = db.prepare('SELECT COALESCE(AVG(progress_percent), 0) AS average FROM enrollments WHERE course_id = ?').get(courseId);
  const quizzes = db.prepare('SELECT id FROM quizzes WHERE course_id = ?').all(courseId);
  const quizIds = quizzes.map((quiz) => quiz.id);
  let quizAverage = 0;
  if (quizIds.length) {
    const placeholders = quizIds.map(() => '?').join(',');
    const scores = db
      .prepare(`SELECT COALESCE(AVG(score), 0) AS average FROM quiz_attempts WHERE quiz_id IN (${placeholders}) AND submitted_at IS NOT NULL`)
      .get(...quizIds);
    quizAverage = Math.round(Number(scores.average));
  }
  const revenue = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE course_id = ? AND status = 'success'")
    .get(courseId);
  const submissions = db
    .prepare(
      `SELECT COUNT(*) AS count FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
       WHERE a.course_id = ? AND s.status = 'submitted'`,
    )
    .get(courseId);
  return {
    learners: Number(learners.count),
    avg_progress: Math.round(Number(avg.average)),
    quiz_average: quizAverage,
    revenue: Number(revenue.total),
    pending_submissions: Number(submissions.count),
  };
}

router.get('/overview', (req, res) => {
  const courses = ownCourses(req.user);
  const courseRows = courses.map((course) => ({
    ...course,
    ...courseStats(course.id),
    modules: Number(db.prepare('SELECT COUNT(*) AS count FROM modules WHERE course_id = ?').get(course.id).count),
    lectures: Number(
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM lectures l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ?',
        )
        .get(course.id).count,
    ),
  }));
  const courseIds = courses.map((course) => course.id);
  let pendingSubmissions = [];
  if (courseIds.length) {
    const placeholders = courseIds.map(() => '?').join(',');
    pendingSubmissions = db
      .prepare(
        `SELECT s.*, a.title AS assignment_title, c.title AS course_title, u.full_name AS student_name
         FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
         JOIN courses c ON c.id = a.course_id JOIN users u ON u.id = s.user_id
         WHERE a.course_id IN (${placeholders}) AND s.status = 'submitted'
         ORDER BY s.submitted_at DESC LIMIT 8`,
      )
      .all(...courseIds);
  }
  const learners = courseIds.length
    ? db
        .prepare(
          `SELECT COUNT(DISTINCT e.user_id) AS count FROM enrollments e WHERE e.course_id IN (${courseIds
            .map(() => '?')
            .join(',')})`,
        )
        .get(...courseIds)
    : { count: 0 };
  const drafts = db
    .prepare(
      `SELECT q.*, c.title AS course_title,
              (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count
       FROM quizzes q JOIN courses c ON c.id = q.course_id
       WHERE q.status = 'draft' ${req.user.role === 'admin' ? '' : 'AND c.instructor_id = ?'}
       ORDER BY q.created_at DESC LIMIT 5`,
    )
    .all(...(req.user.role === 'admin' ? [] : [req.user.id]));
  const recentEnrollments = courseIds.length
    ? db
        .prepare(
          `SELECT e.enrolled_at, u.full_name AS student_name, c.title AS course_title
           FROM enrollments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id
           WHERE e.course_id IN (${courseIds.map(() => '?').join(',')})
           ORDER BY e.enrolled_at DESC LIMIT 6`,
        )
        .all(...courseIds)
    : [];
  const totalRevenue = courseRows.reduce((sum, course) => sum + course.revenue, 0);
  const totalLearners = Number(learners.count);
  const avgCompletion = courseRows.length
    ? Math.round(courseRows.reduce((sum, course) => sum + course.avg_progress, 0) / courseRows.length)
    : 0;

  res.json({
    stats: {
      total_courses: courseRows.length,
      published_courses: courseRows.filter((course) => course.status === 'approved').length,
      pending_courses: courseRows.filter((course) => course.status === 'pending').length,
      learners: totalLearners,
      avg_completion: avgCompletion,
      revenue: totalRevenue,
      pending_submissions: courseRows.reduce((sum, course) => sum + course.pending_submissions, 0),
    },
    courses: courseRows,
    pending_submissions: pendingSubmissions,
    drafts,
    recent_enrollments: recentEnrollments,
  });
});

router.get('/courses', (req, res) => {
  const courses = ownCourses(req.user).map((course) => ({
    ...course,
    ...courseStats(course.id),
    modules: db
      .prepare('SELECT id, title, order_index FROM modules WHERE course_id = ? ORDER BY order_index ASC')
      .all(course.id)
      .map((module) => ({
        ...module,
        lectures: db
          .prepare('SELECT id, title, duration_seconds, order_index FROM lectures WHERE module_id = ? ORDER BY order_index ASC')
          .all(module.id),
      })),
  }));
  res.json({ courses });
});

router.get('/analytics', (req, res) => {
  const courses = ownCourses(req.user);
  const analytics = courses.map((course) => {
    const stats = courseStats(course.id);
    const lectures = db
      .prepare(
        `SELECT l.id, l.title, l.duration_seconds,
                COUNT(DISTINCT lp.enrollment_id) AS viewers,
                SUM(CASE WHEN lp.completed = 1 THEN 1 ELSE 0 END) AS completions,
                COALESCE(AVG(lp.watched_seconds), 0) AS avg_watched
         FROM lectures l JOIN modules m ON m.id = l.module_id
         LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id
         WHERE m.course_id = ? GROUP BY l.id ORDER BY m.order_index ASC, l.order_index ASC`,
      )
      .all(course.id);
    const totalStudents = Math.max(stats.learners, 1);
    return {
      course: {
        id: course.id,
        title: course.title,
        status: course.status,
        price: Number(course.price),
        rating: Number(course.rating),
      },
      stats,
      lectures: lectures.map((lecture) => ({
        ...lecture,
        viewers: Number(lecture.viewers),
        completions: Number(lecture.completions),
        avg_watched: Math.round(Number(lecture.avg_watched)),
        drop_off: Math.max(0, 100 - Math.round((Number(lecture.completions) / totalStudents) * 100)),
      })),
    };
  });
  res.json({ analytics });
});

router.get('/students', (req, res) => {
  const courses = ownCourses(req.user);
  if (!courses.length) return res.json({ students: [] });
  const placeholders = courses.map(() => '?').join(',');
  const students = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.headline,
              COUNT(DISTINCT e.course_id) AS course_count,
              ROUND(AVG(e.progress_percent), 0) AS avg_progress,
              MAX(e.enrolled_at) AS last_enrolled,
              (SELECT COUNT(*) FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
               WHERE s.user_id = u.id AND a.course_id IN (${placeholders})) AS submission_count
       FROM users u JOIN enrollments e ON e.user_id = u.id
       WHERE e.course_id IN (${placeholders}) AND u.role = 'student'
       GROUP BY u.id ORDER BY avg_progress DESC`,
    )
    .all(...courses.map((course) => course.id), ...courses.map((course) => course.id));
  res.json({ students });
});

router.get('/courses/:id/roster', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  if (req.user.role !== 'admin' && course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not own this course.' } });
  }
  const roster = db
    .prepare(
      `SELECT e.id AS enrollment_id, e.progress_percent, e.enrolled_at, u.id, u.full_name, u.email,
              (SELECT COALESCE(MAX(qa.score), 0) FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
               WHERE qa.user_id = u.id AND q.course_id = ?) AS best_quiz
       FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? ORDER BY e.progress_percent DESC`,
    )
    .all(course.id, course.id);
  res.json({ course, roster });
});

router.post('/quizzes/:id/publish', (req, res) => {
  const quiz = db
    .prepare('SELECT q.*, c.instructor_id FROM quizzes q JOIN courses c ON c.id = q.course_id WHERE q.id = ?')
    .get(req.params.id);
  if (!quiz) return res.status(404).json({ error: { code: 'QUIZ_NOT_FOUND', message: 'Quiz not found.' } });
  if (req.user.role !== 'admin' && quiz.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not own this quiz.' } });
  }
  db.prepare("UPDATE quizzes SET status = 'approved' WHERE id = ?").run(quiz.id);
  recordAudit(req.user.id, 'quiz.published', 'quiz', quiz.id, {});
  res.json({ quiz: { ...quiz, status: 'approved' } });
});

router.get('/submissions', (req, res) => {
  const courses = ownCourses(req.user);
  if (!courses.length) return res.json({ submissions: [] });
  const placeholders = courses.map(() => '?').join(',');
  const submissions = db
    .prepare(
      `SELECT s.*, a.title AS assignment_title, c.title AS course_title, u.full_name AS student_name
       FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id JOIN users u ON u.id = s.user_id
       WHERE a.course_id IN (${placeholders}) ORDER BY s.submitted_at DESC`,
    )
    .all(...courses.map((course) => course.id));
  res.json({ submissions });
});

router.post('/courses/:id/announcements', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  if (req.user.role !== 'admin' && course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not own this course.' } });
  }
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Announcement content is required.' } });
  db.prepare(
    'INSERT INTO announcements (id, course_id, posted_by, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(`ann-${crypto.randomUUID()}`, course.id, req.user.id, String(req.body.title || 'Course update'), content, now());
  res.status(201).json({ ok: true });
});

export default router;
