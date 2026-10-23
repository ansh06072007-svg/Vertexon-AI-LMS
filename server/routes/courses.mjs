import { Router } from 'express';
import { db, id, now, recordAudit } from '../db.mjs';
import { authRequired, optionalAuth, roleRequired } from '../auth.mjs';
import { notifyUser } from '../accomplishments.mjs';

const router = Router();

const publicCourse = (course) => ({
  ...course,
  price: Number(course.price || 0),
  rating: Number(course.rating || 0),
  lessons_count: Number(course.lessons_count || 0),
});

function courseAccess(course, user) {
  if (!course) return false;
  if (course.status === 'approved') return true;
  if (!user) return false;
  return user.role === 'admin' || (user.role === 'instructor' && course.instructor_id === user.id);
}

function withEnrollment(course, userId) {
  if (!userId) return { ...course, enrolled: false, progress: 0, enrollment_id: null };
  const enrollment = db
    .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(userId, course.id);
  return {
    ...course,
    enrolled: Boolean(enrollment),
    progress: enrollment ? Number(enrollment.progress_percent) : 0,
    enrollment_id: enrollment?.id || null,
  };
}

router.get('/', optionalAuth, (req, res) => {
  const {
    category,
    difficulty,
    q = '',
    page = '1',
    limit = '50',
    min_rating = '0',
    price = 'any',
    sort = 'recommended',
  } = req.query;
  const clauses = [];
  const params = [];

  if (req.user?.role === 'admin') {
    // Admins can inspect every course.
  } else if (req.user?.role === 'instructor') {
    clauses.push("(c.status = 'approved' OR c.instructor_id = ?)");
    params.push(req.user.id);
  } else {
    clauses.push("c.status = 'approved'");
  }
  if (category && category !== 'All courses') {
    clauses.push('c.category = ?');
    params.push(category);
  }
  if (difficulty && difficulty !== 'Any level') {
    clauses.push('c.difficulty = ?');
    params.push(difficulty);
  }
  const ratingFloor = Number(min_rating);
  if (Number.isFinite(ratingFloor) && ratingFloor > 0) {
    clauses.push('c.rating >= ?');
    params.push(Math.min(5, ratingFloor));
  }
  if (price === 'free') clauses.push('c.price = 0');
  if (price === 'paid') clauses.push('c.price > 0');
  if (q) {
    clauses.push('(c.title LIKE ? OR c.description LIKE ? OR c.category LIKE ? OR u.full_name LIKE ?)');
    const term = `%${q}%`;
    params.push(term, term, term, term);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM courses c JOIN users u ON u.id = c.instructor_id ${where}`)
    .get(...params);
  const sortMap = {
    recommended: 'c.rating DESC, c.created_at DESC',
    newest: 'c.created_at DESC',
    rating: 'c.rating DESC, c.created_at DESC',
    price_low: 'c.price ASC, c.rating DESC',
    price_high: 'c.price DESC, c.rating DESC',
    popular: '(SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) DESC, c.rating DESC',
  };
  const orderBy = sortMap[String(sort)] || sortMap.recommended;
  const rows = db
    .prepare(
      `SELECT c.*, u.full_name AS instructor_name,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS learner_count,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count
       FROM courses c JOIN users u ON u.id = c.instructor_id
       ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (pageNumber - 1) * pageSize);

  res.json({
    courses: rows.map((course) => withEnrollment(publicCourse(course), req.user?.id)),
    total: Number(total.count),
    page: pageNumber,
    limit: pageSize,
    filters: { category: category || null, difficulty: difficulty || null, min_rating: ratingFloor || 0, price, sort },
  });
});

router.get('/:id', optionalAuth, (req, res) => {
  const course = db
    .prepare(
      `SELECT c.*, u.full_name AS instructor_name, u.headline AS instructor_headline,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS learner_count
       FROM courses c JOIN users u ON u.id = c.instructor_id WHERE c.id = ?`,
    )
    .get(req.params.id);
  if (!course || !courseAccess(course, req.user)) {
    return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  }
  const modules = db
    .prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY order_index ASC')
    .all(course.id)
    .map((module) => ({
      ...module,
      lectures: db
        .prepare('SELECT * FROM lectures WHERE module_id = ? ORDER BY order_index ASC')
        .all(module.id)
        .map((lecture) => ({
          ...lecture,
          duration_seconds: Number(lecture.duration_seconds),
          resource_urls: safeJson(lecture.resource_urls, []),
        })),
    }));
  res.json({
    course: withEnrollment(publicCourse(course), req.user?.id),
    modules,
    can_edit: Boolean(req.user && (req.user.role === 'admin' || course.instructor_id === req.user.id)),
  });
});

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

router.post('/', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const category = String(req.body.category || 'Development').trim();
  const difficulty = String(req.body.difficulty || 'Beginner').trim();
  const price = Number(req.body.price || 0);
  const thumbnailUrl = String(req.body.thumbnail_url || '').trim() || null;
  if (title.length < 4) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Course title must be at least 4 characters.', field: 'title' },
    });
  }
  if (!['Beginner', 'Intermediate', 'Advanced'].includes(difficulty)) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Difficulty must be Beginner, Intermediate, or Advanced.', field: 'difficulty' },
    });
  }
  const course = {
    id: id('course'),
    instructor_id: req.user.id,
    title,
    description,
    category,
    difficulty,
    thumbnail_url: thumbnailUrl,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    status: 'pending',
    rating: 0,
    lessons_count: 0,
    glyph: category.slice(0, 3).toUpperCase(),
    tone: 'from-[#1c1a36] via-[#141326] to-[#0d0c16]',
    tag_class: 'text-primary-200 border-primary-300/20 bg-primary-500/10',
    created_at: now(),
    updated_at: now(),
  };
  db.prepare(
    `INSERT INTO courses
     (id, instructor_id, title, description, category, difficulty, thumbnail_url, price, status, rating, lessons_count, glyph, tone, tag_class, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    course.id,
    course.instructor_id,
    course.title,
    course.description,
    course.category,
    course.difficulty,
    course.thumbnail_url,
    course.price,
    course.status,
    course.rating,
    course.lessons_count,
    course.glyph,
    course.tone,
    course.tag_class,
    course.created_at,
    course.updated_at,
  );
  recordAudit(req.user.id, 'course.created', 'course', course.id, { title: course.title });
  res.status(201).json({ course: publicCourse(course) });
});

router.put('/:id', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  if (req.user.role !== 'admin' && course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own courses.' } });
  }
  const allowed = ['title', 'description', 'category', 'difficulty', 'price', 'thumbnail_url'];
  const updates = [];
  const values = [];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(field === 'price' ? Number(req.body[field]) || 0 : String(req.body[field]));
    }
  });
  if (!updates.length) return res.status(422).json({ error: { code: 'NO_CHANGES', message: 'No supported fields supplied.' } });
  updates.push('updated_at = ?');
  values.push(now(), course.id);
  db.prepare(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM courses WHERE id = ?').get(course.id);
  res.json({ course: publicCourse(updated) });
});

router.post('/:id/modules', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  if (req.user.role !== 'admin' && course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own courses.' } });
  }
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Module title is required.' } });
  const order = db.prepare('SELECT COUNT(*) AS count FROM modules WHERE course_id = ?').get(course.id);
  const module = { id: id('module'), course_id: course.id, title, order_index: Number(order.count) + 1 };
  db.prepare('INSERT INTO modules (id, course_id, title, order_index) VALUES (?, ?, ?, ?)').run(
    module.id,
    module.course_id,
    module.title,
    module.order_index,
  );
  res.status(201).json({ module });
});

router.post('/modules/:moduleId/lectures', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(req.params.moduleId);
  if (!module) return res.status(404).json({ error: { code: 'MODULE_NOT_FOUND', message: 'Module not found.' } });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(module.course_id);
  if (!course || (req.user.role !== 'admin' && course.instructor_id !== req.user.id)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot add lectures to this course.' } });
  }
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Lecture title is required.' } });
  const duration = Math.max(0, Number(req.body.duration_seconds) || 0);
  const transcript = String(req.body.transcript || '').trim();
  const order = db.prepare('SELECT COUNT(*) AS count FROM lectures WHERE module_id = ?').get(module.id);
  const lecture = {
    id: id('lecture'),
    module_id: module.id,
    title,
    video_url: req.body.video_url || 'https://storage.vertexon.ai/courses/demo/master.m3u8',
    transcript,
    duration_seconds: duration,
    order_index: Number(order.count) + 1,
    resource_urls: JSON.stringify(req.body.resource_urls || []),
    created_at: now(),
  };
  db.prepare(
    `INSERT INTO lectures (id, module_id, title, video_url, transcript, duration_seconds, order_index, resource_urls, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    lecture.id,
    lecture.module_id,
    lecture.title,
    lecture.video_url,
    lecture.transcript,
    lecture.duration_seconds,
    lecture.order_index,
    lecture.resource_urls,
    lecture.created_at,
  );
  db.prepare('UPDATE courses SET lessons_count = lessons_count + 1, updated_at = ? WHERE id = ?').run(now(), course.id);
  indexTranscript(course.id, lecture);
  res.status(201).json({ lecture });
});

function indexTranscript(courseId, lecture) {
  if (!lecture.transcript) return;
  const sentences = lecture.transcript
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30);
  sentences.forEach((sentence, index) => {
    const timestamp = Math.round((index / Math.max(sentences.length, 1)) * (lecture.duration_seconds || 600));
    db.prepare(
      'INSERT INTO document_chunks (id, course_id, lecture_id, chunk_text, timestamp_seconds, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id('chunk'), courseId, lecture.id, sentence, timestamp, null, now());
  });
}

router.post('/:id/approve', authRequired, roleRequired('admin'), (req, res) => {
  const decision = String(req.body.decision || 'approved');
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Decision must be approved or rejected.' } });
  }
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  db.prepare('UPDATE courses SET status = ?, updated_at = ? WHERE id = ?').run(decision, now(), course.id);
  db.prepare(
    'INSERT INTO course_approvals (id, course_id, reviewed_by, decision, comment, reviewed_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id('approval'), course.id, req.user.id, decision, String(req.body.comment || ''), now());
  notifyUser(
    course.instructor_id,
    `Course ${decision}`,
    `${course.title} was ${decision} by the platform team.`,
    { email: true, emailSubject: `${course.title} was ${decision}` },
  );
  recordAudit(req.user.id, `course.${decision}`, 'course', course.id, { title: course.title });
  res.json({ course: { ...course, status: decision } });
});

router.post('/:id/announcements', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: { code: 'COURSE_NOT_FOUND', message: 'Course not found.' } });
  if (req.user.role !== 'admin' && course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only post to your own courses.' } });
  }
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Announcement content is required.' } });
  const announcement = {
    id: id('ann'),
    course_id: course.id,
    posted_by: req.user.id,
    title: String(req.body.title || 'Course announcement'),
    content,
    created_at: now(),
  };
  db.prepare(
    'INSERT INTO announcements (id, course_id, posted_by, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    announcement.id,
    announcement.course_id,
    announcement.posted_by,
    announcement.title,
    announcement.content,
    announcement.created_at,
  );
  const learners = db.prepare('SELECT user_id FROM enrollments WHERE course_id = ?').all(course.id);
  learners.forEach((learner) => {
    notifyUser(
      learner.user_id,
      `Announcement · ${course.title}`,
      `${announcement.title}: ${announcement.content}`,
      { email: true, emailSubject: `Announcement in ${course.title}` },
    );
  });
  res.status(201).json({ announcement });
});

export default router;
