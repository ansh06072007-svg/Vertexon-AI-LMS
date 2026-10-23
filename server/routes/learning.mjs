import { Router } from 'express';
import { db, id, now, recordAudit } from '../db.mjs';
import { authRequired, roleRequired } from '../auth.mjs';
import { upload, materialUpload } from '../upload.mjs';
import {
  getMastery,
  notifyUser,
  queueEmail,
  syncCourseCompletion,
  touchStreak,
} from '../accomplishments.mjs';

const router = Router();

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

function lectureContext(lectureId) {
  return db
    .prepare(
      `SELECT l.*, m.course_id, c.title AS course_title, c.instructor_id
       FROM lectures l JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
       WHERE l.id = ?`,
    )
    .get(lectureId);
}

function enrollmentFor(userId, courseId) {
  return db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, courseId);
}

/**
 * Recalculate the recommendation widget from real learning signals.
 * Weak topics drive keyword affinity, while quiz average drives difficulty fit.
 * The resulting rows are persisted so every surface reads the same ranking.
 */
function refreshRecommendations(userId) {
  const enrolled = db
    .prepare(
      `SELECT e.course_id, e.progress_percent, c.category
       FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ?`,
    )
    .all(userId);
  if (!enrolled.length) return;
  const enrolledIds = new Set(enrolled.map((item) => item.course_id));
  const categories = new Set(enrolled.map((item) => item.category).filter(Boolean));
  const weakTopics = getMastery(userId)
    .filter((item) => item.mastery < 80)
    .slice(0, 4);
  const keywords = [
    ...new Set(
      weakTopics.flatMap((item) =>
        String(item.topic)
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((word) => word.length > 3),
      ),
    ),
  ];
  const average = db
    .prepare('SELECT COALESCE(AVG(score), 0) AS average FROM quiz_attempts WHERE user_id = ? AND submitted_at IS NOT NULL')
    .get(userId);
  const averageScore = Number(average.average);
  const candidates = db
    .prepare(
      `SELECT * FROM courses
       WHERE status = 'approved' AND instructor_id != ?
       ORDER BY rating DESC, created_at DESC`,
    )
    .all(userId)
    .filter((course) => !enrolledIds.has(course.id));

  const ranked = candidates
    .map((course) => {
      const haystack = `${course.title} ${course.description || ''} ${course.category || ''}`.toLowerCase();
      const topicHits = keywords.filter((word) => haystack.includes(word)).length;
      const categoryMatch = categories.has(course.category) ? 10 : 0;
      const expectedDifficulty =
        averageScore >= 80 ? 'Advanced' : averageScore >= 55 ? 'Intermediate' : 'Beginner';
      const difficultyMatch = course.difficulty === expectedDifficulty ? 8 : 0;
      const weakest = weakTopics.find((item) =>
        String(item.topic)
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((word) => word.length > 3)
          .some((word) => haystack.includes(word)),
      );
      const reason = weakest
        ? `Your ${weakest.topic} mastery is ${weakest.mastery}% — this course adds related practice.`
        : categoryMatch
          ? `Continue your ${course.category} path with a ${String(course.difficulty || 'guided').toLowerCase()} course.`
          : `Matched to your quiz profile at ${Math.round(averageScore)}% average.`;
      return {
        course,
        score: Math.round(
          Math.min(99, 45 + Number(course.rating || 0) * 4 + categoryMatch + topicHits * 12 + difficultyMatch),
        ),
        reason,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  if (!ranked.length) return;
  db.prepare('DELETE FROM recommendations WHERE user_id = ?').run(userId);
  const insert = db.prepare(
    'INSERT INTO recommendations (id, user_id, recommended_course_id, reason, score, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  ranked.forEach((item) => {
    insert.run(id('rec'), userId, item.course.id, item.reason, item.score, now());
  });
}

router.post('/uploads/material', authRequired, roleRequired('instructor', 'admin'), materialUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(422).json({ error: { code: 'FILE_REQUIRED', message: 'Choose a file to upload.' } });
  }
  res.status(201).json({
    file: {
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      size: req.file.size,
      mime_type: req.file.mimetype,
    },
  });
});

router.post('/courses/:id/enroll', authRequired, roleRequired('student'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course || course.status !== 'approved') {
    return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found or not approved.' } });
  }
  const existing = enrollmentFor(req.user.id, course.id);
  if (existing) return res.status(200).json({ enrollment: existing, already_enrolled: true });
  const enrollment = {
    id: id('enrollment'),
    user_id: req.user.id,
    course_id: course.id,
    enrolled_at: now(),
    progress_percent: 0,
  };
  db.prepare(
    'INSERT INTO enrollments (id, user_id, course_id, enrolled_at, progress_percent) VALUES (?, ?, ?, ?, ?)',
  ).run(enrollment.id, enrollment.user_id, enrollment.course_id, enrollment.enrolled_at, enrollment.progress_percent);
  db.prepare(
    'INSERT INTO notifications (id, user_id, title, body, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)',
  ).run(
    id('notif'),
    course.instructor_id,
    'New enrollment',
    `${req.user.full_name} enrolled in ${course.title}.`,
    now(),
  );
  queueEmail(
    req.user.id,
    `You enrolled in ${course.title}`,
    `Hi ${req.user.full_name}, you are now enrolled in ${course.title}. Open Vertexon to continue learning.`,
  );
  recordAudit(req.user.id, 'course.enrolled', 'course', course.id, { title: course.title });
  res.status(201).json({ enrollment });
});

router.get('/enrollments/me', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT e.*, c.title, c.category, c.difficulty, c.rating, c.lessons_count, c.glyph, c.tone,
              c.tag_class, u.full_name AS instructor_name,
              (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) AS assignment_count
       FROM enrollments e JOIN courses c ON c.id = e.course_id JOIN users u ON u.id = c.instructor_id
       WHERE e.user_id = ? ORDER BY e.enrolled_at DESC`,
    )
    .all(req.user.id);
  res.json({
    enrollments: rows.map((row) => ({
      ...row,
      progress: Number(row.progress_percent),
      lessons_count: Number(row.lessons_count),
    })),
  });
});

router.get('/dashboard/me', authRequired, (req, res) => {
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.user.id);
  const enrolled = db
    .prepare(
      `SELECT e.*, c.title, c.category, c.lessons_count, c.glyph, c.tone, c.tag_class, c.difficulty
       FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? ORDER BY e.progress_percent DESC`,
    )
    .all(req.user.id);
  const completedCourses = enrolled.filter((course) => Number(course.progress_percent) >= 100).length;
  const completedLessons = enrolled.reduce(
    (total, course) =>
      total + Math.round((Number(course.lessons_count) * Number(course.progress_percent)) / 100),
    0,
  );
  const watched = db
    .prepare(
      `SELECT COALESCE(SUM(lp.watched_seconds), 0) AS seconds FROM lecture_progress lp
       JOIN enrollments e ON e.id = lp.enrollment_id WHERE e.user_id = ?`,
    )
    .get(req.user.id);
  const unread = db
    .prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.user.id);
  const nextCourse = enrolled.find((course) => Number(course.progress_percent) > 0 && Number(course.progress_percent) < 100);
  if (req.user.role === 'student') refreshRecommendations(req.user.id);
  const recommendations = db
    .prepare(
      `SELECT r.*, c.title, c.category, c.difficulty, c.glyph, c.tone, c.tag_class
       FROM recommendations r JOIN courses c ON c.id = r.recommended_course_id
       WHERE r.user_id = ? ORDER BY r.score DESC LIMIT 3`,
    )
    .all(req.user.id);
  const leaderboard = db
    .prepare(
      `SELECT u.id, u.full_name, s.current_streak,
              COALESCE((SELECT ROUND(SUM(qa.score), 0) FROM quiz_attempts qa WHERE qa.user_id = u.id), 0) AS points
       FROM streaks s JOIN users u ON u.id = s.user_id
       WHERE u.role = 'student' ORDER BY points DESC, s.current_streak DESC LIMIT 6`,
    )
    .all();
  const certificates = db
    .prepare(
      `SELECT cert.*, c.title AS course_title FROM certificates cert JOIN courses c ON c.id = cert.course_id
       WHERE cert.user_id = ? ORDER BY cert.issued_at DESC`,
    )
    .all(req.user.id);
  const recentAttempts = db
    .prepare(
      `SELECT qa.*, q.title AS quiz_title FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
       WHERE qa.user_id = ? ORDER BY qa.started_at DESC LIMIT 5`,
    )
    .all(req.user.id);

  res.json({
    user: { id: req.user.id, full_name: req.user.full_name, role: req.user.role },
    streak: streak || { current_streak: 0, longest_streak: 0, last_active_date: null },
    stats: {
      enrolled_courses: enrolled.length,
      completed_courses: completedCourses,
      completed_lessons: completedLessons,
      hours_learned: Number((Number(watched.seconds) / 3600).toFixed(1)),
      daily_minutes: 53,
      daily_target: 60,
      unread_notifications: Number(unread.count),
    },
    enrolled_courses: enrolled.map((course) => ({
      ...course,
      progress: Number(course.progress_percent),
      lessons_count: Number(course.lessons_count),
    })),
    continue_learning: nextCourse || enrolled[0] || null,
    recommendations,
    leaderboard,
    certificates,
    recent_attempts: recentAttempts,
  });
});

router.post('/lectures/:id/progress', authRequired, roleRequired('student'), (req, res) => {
  const lecture = lectureContext(req.params.id);
  if (!lecture) return res.status(404).json({ error: { code: 'LECTURE_NOT_FOUND', message: 'Lecture not found.' } });
  const enrollment = enrollmentFor(req.user.id, lecture.course_id);
  if (!enrollment) return res.status(403).json({ error: { code: 'NOT_ENROLLED', message: 'Enroll in the course first.' } });
  const completed = req.body.completed ? 1 : 0;
  const watched = Math.max(0, Number(req.body.watched_seconds) || 0);
  const existing = db
    .prepare('SELECT * FROM lecture_progress WHERE enrollment_id = ? AND lecture_id = ?')
    .get(enrollment.id, lecture.id);
  if (existing) {
    db.prepare(
      'UPDATE lecture_progress SET watched_seconds = MAX(watched_seconds, ?), completed = MAX(completed, ?), last_watched_at = ? WHERE id = ?',
    ).run(watched, completed, now(), existing.id);
  } else {
    db.prepare(
      'INSERT INTO lecture_progress (id, enrollment_id, lecture_id, watched_seconds, completed, last_watched_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id('progress'), enrollment.id, lecture.id, watched, completed, now());
  }

  let progress = Number(enrollment.progress_percent);
  const lecturesTotal = db
    .prepare(
      `SELECT COUNT(*) AS count FROM lectures l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ?`,
    )
    .get(lecture.course_id);
  const completedTotal = db
    .prepare(
      `SELECT COUNT(*) AS count FROM lecture_progress lp JOIN enrollments e ON e.id = lp.enrollment_id
       WHERE e.id = ? AND lp.completed = 1`,
    )
    .get(enrollment.id);
  const calculated = Number(lecturesTotal.count)
    ? Math.round((Number(completedTotal.count) / Number(lecturesTotal.count)) * 100)
    : progress;
  // Keep manually seeded/legacy progress from moving backwards, while deriving
  // real 100% completion from the lecture_progress rows.
  progress = Number(completedTotal.count) >= Number(lecturesTotal.count) && Number(lecturesTotal.count) > 0
    ? 100
    : Math.max(progress, calculated);
  db.prepare('UPDATE enrollments SET progress_percent = ? WHERE id = ?').run(progress, enrollment.id);
  const streak = touchStreak(req.user.id);
  let certificate = null;
  let badges = [];
  if (progress >= 100) {
    const completed = syncCourseCompletion(req.user.id, lecture.course_id);
    certificate = completed.certificate;
    badges = completed.badges;
  }
  res.json({
    progress,
    completed: Boolean(completed),
    watched_seconds: watched,
    streak,
    certificate,
    badges,
  });
});

router.get('/lectures/:id/notes', authRequired, (req, res) => {
  const notes = db
    .prepare('SELECT * FROM notes WHERE lecture_id = ? AND user_id = ? ORDER BY timestamp_seconds ASC')
    .all(req.params.id, req.user.id);
  const bookmark = db
    .prepare('SELECT * FROM bookmarks WHERE lecture_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(req.params.id, req.user.id);
  const lecture = lectureContext(req.params.id);
  const enrollment = lecture
    ? db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, lecture.course_id)
    : null;
  const progress = enrollment
    ? db
        .prepare('SELECT watched_seconds, completed FROM lecture_progress WHERE enrollment_id = ? AND lecture_id = ?')
        .get(enrollment.id, req.params.id)
    : null;
  res.json({
    notes,
    bookmark: bookmark || null,
    progress: progress || { watched_seconds: 0, completed: 0 },
  });
});

router.post('/lectures/:id/notes', authRequired, (req, res) => {
  const lecture = lectureContext(req.params.id);
  if (!lecture) return res.status(404).json({ error: { code: 'LECTURE_NOT_FOUND', message: 'Lecture not found.' } });
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Note cannot be empty.', field: 'content' } });
  const note = {
    id: id('note'),
    user_id: req.user.id,
    lecture_id: lecture.id,
    timestamp_seconds: Math.max(0, Number(req.body.timestamp_seconds) || 0),
    content,
    created_at: now(),
    updated_at: now(),
  };
  db.prepare(
    'INSERT INTO notes (id, user_id, lecture_id, timestamp_seconds, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(note.id, note.user_id, note.lecture_id, note.timestamp_seconds, note.content, note.created_at, note.updated_at);
  res.status(201).json({ note });
});

router.put('/notes/:id', authRequired, (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: { code: 'NOTE_NOT_FOUND', message: 'Note not found.' } });
  if (note.user_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own notes.' } });
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Note cannot be empty.' } });
  db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?').run(content, now(), note.id);
  res.json({ note: { ...note, content, updated_at: now() } });
});

router.delete('/notes/:id', authRequired, (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: { code: 'NOTE_NOT_FOUND', message: 'Note not found.' } });
  if (note.user_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own notes.' } });
  db.prepare('DELETE FROM notes WHERE id = ?').run(note.id);
  res.status(204).end();
});

router.post('/lectures/:id/bookmarks', authRequired, (req, res) => {
  const lecture = lectureContext(req.params.id);
  if (!lecture) return res.status(404).json({ error: { code: 'LECTURE_NOT_FOUND', message: 'Lecture not found.' } });
  const timestamp = Math.max(0, Number(req.body.timestamp_seconds) || 0);
  const existing = db
    .prepare('SELECT * FROM bookmarks WHERE user_id = ? AND lecture_id = ? AND timestamp_seconds = ?')
    .get(req.user.id, lecture.id, timestamp);
  if (existing) return res.json({ bookmark: existing, already_exists: true });
  const bookmark = {
    id: id('bookmark'),
    user_id: req.user.id,
    lecture_id: lecture.id,
    timestamp_seconds: timestamp,
    created_at: now(),
  };
  db.prepare('INSERT INTO bookmarks (id, user_id, lecture_id, timestamp_seconds, created_at) VALUES (?, ?, ?, ?, ?)').run(
    bookmark.id,
    bookmark.user_id,
    bookmark.lecture_id,
    bookmark.timestamp_seconds,
    bookmark.created_at,
  );
  res.status(201).json({ bookmark });
});

router.delete('/bookmarks/:id', authRequired, (req, res) => {
  const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  if (!bookmark) return res.status(404).json({ error: { code: 'BOOKMARK_NOT_FOUND', message: 'Bookmark not found.' } });
  if (bookmark.user_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own bookmarks.' } });
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(bookmark.id);
  res.status(204).end();
});

router.get('/courses/:id/announcements', authRequired, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  const isMember = enrollmentFor(req.user.id, course.id);
  if (!isMember && req.user.role === 'student') {
    return res.status(403).json({ error: { code: 'NOT_ENROLLED', message: 'Enroll to view announcements.' } });
  }
  const announcements = db
    .prepare(
      `SELECT a.*, u.full_name AS author_name FROM announcements a JOIN users u ON u.id = a.posted_by
       WHERE a.course_id = ? ORDER BY a.created_at DESC`,
    )
    .all(course.id);
  res.json({ announcements });
});

// ----------------------------- ASSIGNMENTS -----------------------------

router.get('/assignments/me', authRequired, (req, res) => {
  let assignments = [];
  if (req.user.role === 'student') {
    assignments = db
      .prepare(
        `SELECT a.*, c.title AS course_title,
                s.id AS submission_id, s.file_name, s.file_url, s.submitted_at, s.grade, s.feedback, s.status
         FROM assignments a JOIN courses c ON c.id = a.course_id
         JOIN enrollments e ON e.course_id = a.course_id AND e.user_id = ?
         LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = ?
         ORDER BY a.due_date ASC`,
      )
      .all(req.user.id, req.user.id);
  } else if (req.user.role === 'instructor') {
    assignments = db
      .prepare(
        `SELECT a.*, c.title AS course_title,
                (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id = a.id) AS submission_count,
                (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.status = 'submitted') AS needs_grading
         FROM assignments a JOIN courses c ON c.id = a.course_id
         WHERE c.instructor_id = ? ORDER BY a.due_date ASC`,
      )
      .all(req.user.id);
  } else {
    assignments = db
      .prepare(
        `SELECT a.*, c.title AS course_title,
                (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id = a.id) AS submission_count,
                (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.status = 'submitted') AS needs_grading
         FROM assignments a JOIN courses c ON c.id = a.course_id ORDER BY a.due_date ASC`,
      )
      .all();
  }
  res.json({
    assignments: assignments.map((assignment) => ({
      ...assignment,
      rubric: parseJson(assignment.rubric, {}),
      grade: assignment.grade === null || assignment.grade === undefined ? null : Number(assignment.grade),
    })),
  });
});

router.post('/assignments', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.body.course_id);
  if (!course) return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  if (req.user.role !== 'admin' && course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only create assignments for your own courses.' } });
  }
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Assignment title is required.' } });
  const assignment = {
    id: id('assignment'),
    course_id: course.id,
    title,
    instructions: String(req.body.instructions || ''),
    rubric: JSON.stringify(req.body.rubric || {}),
    due_date: req.body.due_date || null,
    created_at: now(),
  };
  db.prepare(
    'INSERT INTO assignments (id, course_id, title, instructions, rubric, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    assignment.id,
    assignment.course_id,
    assignment.title,
    assignment.instructions,
    assignment.rubric,
    assignment.due_date,
    assignment.created_at,
  );
  res.status(201).json({ assignment: { ...assignment, rubric: req.body.rubric || {} } });
});

router.post('/assignments/:id/submit', authRequired, roleRequired('student'), upload.single('file'), (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!assignment) return res.status(404).json({ error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found.' } });
  const enrollment = enrollmentFor(req.user.id, assignment.course_id);
  if (!enrollment) return res.status(403).json({ error: { code: 'NOT_ENROLLED', message: 'Enroll in the course first.' } });
  if (!req.file) return res.status(422).json({ error: { code: 'FILE_REQUIRED', message: 'Attach a PDF, ZIP, or code file.' } });
  const existing = db
    .prepare('SELECT * FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?')
    .get(assignment.id, req.user.id);
  const fileUrl = `/uploads/${req.file.filename}`;
  if (existing) {
    db.prepare(
      `UPDATE assignment_submissions SET file_url = ?, file_name = ?, submitted_at = ?, grade = NULL,
       feedback = NULL, status = 'submitted' WHERE id = ?`,
    ).run(fileUrl, req.file.originalname, now(), existing.id);
  } else {
    db.prepare(
      `INSERT INTO assignment_submissions (id, assignment_id, user_id, file_url, file_name, submitted_at, grade, feedback, status)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'submitted')`,
    ).run(id('submission'), assignment.id, req.user.id, fileUrl, req.file.originalname, now());
  }
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(assignment.course_id);
  notifyUser(
    course.instructor_id,
    'New assignment submission',
    `${req.user.full_name} submitted ${assignment.title}.`,
    { email: true, emailSubject: `New submission: ${assignment.title}` },
  );
  const submission = db
    .prepare('SELECT * FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?')
    .get(assignment.id, req.user.id);
  res.status(201).json({ submission });
});

router.get('/assignments/:id/submissions', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const assignment = db
    .prepare('SELECT a.*, c.instructor_id, c.title AS course_title FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = ?')
    .get(req.params.id);
  if (!assignment) return res.status(404).json({ error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found.' } });
  if (req.user.role !== 'admin' && assignment.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only view submissions for your own courses.' } });
  }
  const submissions = db
    .prepare(
      `SELECT s.*, u.full_name AS student_name, u.email AS student_email
       FROM assignment_submissions s JOIN users u ON u.id = s.user_id
       WHERE s.assignment_id = ? ORDER BY s.submitted_at DESC`,
    )
    .all(assignment.id);
  res.json({ assignment, submissions });
});

router.put('/submissions/:id/grade', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const submission = db
    .prepare(
      `SELECT s.*, a.title AS assignment_title, a.course_id, c.instructor_id
       FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id WHERE s.id = ?`,
    )
    .get(req.params.id);
  if (!submission) return res.status(404).json({ error: { code: 'SUBMISSION_NOT_FOUND', message: 'Submission not found.' } });
  if (req.user.role !== 'admin' && submission.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only grade your own course submissions.' } });
  }
  const grade = Number(req.body.grade);
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Grade must be between 0 and 100.' } });
  }
  const feedback = String(req.body.feedback || '').trim();
  db.prepare("UPDATE assignment_submissions SET grade = ?, feedback = ?, status = 'graded' WHERE id = ?").run(
    grade,
    feedback,
    submission.id,
  );
  notifyUser(
    submission.user_id,
    'Assignment graded',
    `${submission.assignment_title}: ${grade}/100.${feedback ? ` Feedback: ${feedback}` : ''}`,
    { email: true, emailSubject: `Feedback ready: ${submission.assignment_title}` },
  );
  recordAudit(req.user.id, 'submission.graded', 'submission', submission.id, { grade });
  res.json({ submission: { ...submission, grade, feedback, status: 'graded' } });
});

// ----------------------------- DISCUSSIONS -----------------------------

router.get('/discussions/moderation/flagged', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const posts = db
    .prepare(
      `SELECT p.*, u.full_name AS author_name, t.title AS thread_title, t.course_id, c.title AS course_title
       FROM discussion_posts p JOIN users u ON u.id = p.user_id
       JOIN discussion_threads t ON t.id = p.thread_id JOIN courses c ON c.id = t.course_id
       WHERE p.is_flagged = 1 ORDER BY p.created_at DESC`,
    )
    .all();
  res.json({ posts });
});

router.get('/discussions', authRequired, (req, res) => {
  const courseId = req.query.course_id;
  const params = [];
  let where = '';
  if (courseId) {
    where = 'WHERE t.course_id = ?';
    params.push(courseId);
  }
  const threads = db
    .prepare(
      `SELECT t.*, u.full_name AS author_name, c.title AS course_title,
              (SELECT COUNT(*) FROM discussion_posts p WHERE p.thread_id = t.id) AS post_count,
              (SELECT COUNT(*) FROM discussion_posts p WHERE p.thread_id = t.id AND p.is_flagged = 1) AS flagged_count,
              (SELECT MAX(p.created_at) FROM discussion_posts p WHERE p.thread_id = t.id) AS last_activity
       FROM discussion_threads t JOIN users u ON u.id = t.created_by JOIN courses c ON c.id = t.course_id
       ${where} ORDER BY COALESCE(last_activity, t.created_at) DESC`,
    )
    .all(...params);
  res.json({ threads });
});

router.get('/discussions/:id', authRequired, (req, res) => {
  const thread = db
    .prepare(
      `SELECT t.*, u.full_name AS author_name, c.title AS course_title
       FROM discussion_threads t JOIN users u ON u.id = t.created_by JOIN courses c ON c.id = t.course_id
       WHERE t.id = ?`,
    )
    .get(req.params.id);
  if (!thread) return res.status(404).json({ error: { code: 'THREAD_NOT_FOUND', message: 'Thread not found.' } });
  const posts = db
    .prepare(
      `SELECT p.*, u.full_name AS author_name, u.role AS author_role FROM discussion_posts p
       JOIN users u ON u.id = p.user_id WHERE p.thread_id = ? ORDER BY p.created_at ASC`,
    )
    .all(thread.id);
  res.json({ thread, posts });
});

router.post('/discussions', authRequired, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.body.course_id);
  if (!course || course.status !== 'approved') {
    return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  }
  if (req.user.role === 'student' && !enrollmentFor(req.user.id, course.id)) {
    return res.status(403).json({ error: { code: 'NOT_ENROLLED', message: 'Enroll in the course first.' } });
  }
  const title = String(req.body.title || '').trim();
  const content = String(req.body.content || '').trim();
  if (title.length < 4 || !content) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Add a title and opening post.' } });
  }
  const thread = {
    id: id('thread'),
    course_id: course.id,
    created_by: req.user.id,
    title,
    created_at: now(),
  };
  db.prepare('INSERT INTO discussion_threads (id, course_id, created_by, title, created_at) VALUES (?, ?, ?, ?, ?)').run(
    thread.id,
    thread.course_id,
    thread.created_by,
    thread.title,
    thread.created_at,
  );
  db.prepare('INSERT INTO discussion_posts (id, thread_id, user_id, content, is_flagged, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(
    id('post'),
    thread.id,
    req.user.id,
    content,
    now(),
  );
  res.status(201).json({ thread });
});

router.post('/discussions/:id/posts', authRequired, (req, res) => {
  const thread = db
    .prepare('SELECT t.*, c.instructor_id FROM discussion_threads t JOIN courses c ON c.id = t.course_id WHERE t.id = ?')
    .get(req.params.id);
  if (!thread) return res.status(404).json({ error: { code: 'THREAD_NOT_FOUND', message: 'Thread not found.' } });
  if (req.user.role === 'student' && !enrollmentFor(req.user.id, thread.course_id)) {
    return res.status(403).json({ error: { code: 'NOT_ENROLLED', message: 'Enroll in the course first.' } });
  }
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Reply cannot be empty.' } });
  const post = { id: id('post'), thread_id: thread.id, user_id: req.user.id, content, is_flagged: 0, created_at: now() };
  db.prepare('INSERT INTO discussion_posts (id, thread_id, user_id, content, is_flagged, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(
    post.id,
    post.thread_id,
    post.user_id,
    post.content,
    post.created_at,
  );
  res.status(201).json({ post });
});

router.post('/discussion-posts/:id/flag', authRequired, (req, res) => {
  const post = db.prepare('SELECT * FROM discussion_posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post not found.' } });
  db.prepare('UPDATE discussion_posts SET is_flagged = 1 WHERE id = ?').run(post.id);
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
  admins.forEach((admin) => {
    db.prepare('INSERT INTO notifications (id, user_id, title, body, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(
      id('notif'),
      admin.id,
      'Forum post reported',
      `A post was flagged for moderation: "${post.content.slice(0, 80)}…"`,
      now(),
    );
  });
  res.json({ post: { ...post, is_flagged: 1 } });
});

router.delete('/discussion-posts/:id', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const post = db
    .prepare(
      `SELECT p.*, c.instructor_id FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id
       JOIN courses c ON c.id = t.course_id WHERE p.id = ?`,
    )
    .get(req.params.id);
  if (!post) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post not found.' } });
  if (req.user.role !== 'admin' && post.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only moderate your own course threads.' } });
  }
  db.prepare('DELETE FROM discussion_posts WHERE id = ?').run(post.id);
  recordAudit(req.user.id, 'post.moderated', 'discussion_post', post.id, {});
  res.status(204).end();
});

// ----------------------------- NOTIFICATIONS / GAMIFICATION -----------------------------

router.get('/notifications/me', authRequired, (req, res) => {
  const notifications = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
    .all(req.user.id);
  res.json({ notifications });
});

router.put('/notifications/:id/read', authRequired, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.put('/notifications/read-all', authRequired, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.get('/gamification/me', authRequired, (req, res) => {
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.user.id);
  const badges = db
    .prepare(
      `SELECT b.*, ub.earned_at FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = ? ORDER BY ub.earned_at DESC`,
    )
    .all(req.user.id);
  const allBadges = db.prepare('SELECT * FROM badges ORDER BY name ASC').all();
  const attempts = db
    .prepare('SELECT * FROM quiz_attempts WHERE user_id = ? AND submitted_at IS NOT NULL ORDER BY started_at DESC')
    .all(req.user.id);
  const xp = badges.length * 240 + (streak?.current_streak || 0) * 30 + attempts.length * 55;
  res.json({
    streak: streak || { current_streak: 0, longest_streak: 0, last_active_date: null },
    badges,
    all_badges: allBadges,
    quiz_attempts: attempts.length,
    level: Math.max(1, Math.floor(xp / 500) + 1),
    xp,
    next_level_xp: Math.ceil((xp + 1) / 500) * 500,
  });
});

router.get('/leaderboard/:courseId', authRequired, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  const leaderboard = db
    .prepare(
      `SELECT u.id, u.full_name, e.progress_percent,
              COALESCE((SELECT ROUND(MAX(qa.score), 0) FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
                        WHERE qa.user_id = u.id AND q.course_id = ?), 0) AS best_score
       FROM enrollments e JOIN users u ON u.id = e.user_id
       WHERE e.course_id = ? ORDER BY best_score DESC, e.progress_percent DESC LIMIT 20`,
    )
    .all(course.id, course.id);
  res.json({ course: { id: course.id, title: course.title }, leaderboard });
});

router.get('/recommendations/me', authRequired, (req, res) => {
  if (req.user.role === 'student') refreshRecommendations(req.user.id);
  const recommendations = db
    .prepare(
      `SELECT r.*, c.title, c.category, c.difficulty, c.glyph, c.tone, c.tag_class
       FROM recommendations r JOIN courses c ON c.id = r.recommended_course_id
       WHERE r.user_id = ? ORDER BY r.score DESC`,
    )
    .all(req.user.id);
  res.json({ recommendations, strategy: 'mastery-keywords+quiz-difficulty+category-affinity' });
});

router.get('/mastery/me', authRequired, (req, res) => {
  const courseId = String(req.query.course_id || '').trim() || null;
  res.json({ mastery: getMastery(req.user.id, courseId) });
});

export default router;
