import { Router } from 'express';
import { db, id, now, recordAudit } from '../db.mjs';
import { authRequired, roleRequired } from '../auth.mjs';
import {
  answerQuestion,
  buildStudyPlan,
  generateFlashcards,
  generateQuizDraft,
  summarizeLecture,
} from '../ai.mjs';

const router = Router();

function courseForUser(courseId, user, { requireEnrollment = true } = {}) {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return { error: { status: 404, code: 'COURSE_NOT_FOUND', message: 'Course not found.' } };
  if (user.role === 'instructor' && course.instructor_id === user.id) return { course };
  if (user.role === 'admin') return { course };
  if (requireEnrollment) {
    const enrollment = db
      .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
      .get(user.id, course.id);
    if (!enrollment) return { error: { status: 403, code: 'NOT_ENROLLED', message: 'Enroll in this course to use its tutor.' } };
  }
  return { course };
}

router.post('/chat', authRequired, (req, res) => {
  const courseId = String(req.body.course_id || 'c-dsa');
  const message = String(req.body.message || '').trim();
  const mode = ['beginner', 'intermediate', 'advanced'].includes(req.body.mode) ? req.body.mode : 'intermediate';
  if (!message) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Ask a question first.' } });
  const access = courseForUser(courseId, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error });

  let session = req.body.session_id
    ? db.prepare('SELECT * FROM ai_chat_sessions WHERE id = ?').get(req.body.session_id)
    : null;
  if (session && session.user_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This chat belongs to another user.' } });
  }
  if (!session) {
    session = { id: id('chat'), user_id: req.user.id, course_id: courseId, mode, created_at: now() };
    db.prepare('INSERT INTO ai_chat_sessions (id, user_id, course_id, mode, created_at) VALUES (?, ?, ?, ?, ?)').run(
      session.id,
      session.user_id,
      session.course_id,
      session.mode,
      session.created_at,
    );
  } else {
    db.prepare('UPDATE ai_chat_sessions SET mode = ? WHERE id = ?').run(mode, session.id);
  }

  db.prepare(
    'INSERT INTO ai_chat_messages (id, session_id, sender, content, source_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id('message'), session.id, 'user', message, null, now());

  const answer = answerQuestion({ courseId, message, mode });
  const aiMessage = {
    id: id('message'),
    session_id: session.id,
    sender: 'ai',
    content: answer.reply,
    source_json: JSON.stringify(answer.sources),
    created_at: now(),
  };
  db.prepare(
    'INSERT INTO ai_chat_messages (id, session_id, sender, content, source_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(aiMessage.id, aiMessage.session_id, aiMessage.sender, aiMessage.content, aiMessage.source_json, aiMessage.created_at);

  res.json({
    session: { ...session, mode },
    message: { ...aiMessage, sources: answer.sources },
    sources: answer.sources,
    mode,
  });
});

router.get('/sessions/me', authRequired, (req, res) => {
  const sessions = db
    .prepare(
      `SELECT s.*, c.title AS course_title,
              (SELECT COUNT(*) FROM ai_chat_messages m WHERE m.session_id = s.id) AS message_count
       FROM ai_chat_sessions s JOIN courses c ON c.id = s.course_id
       WHERE s.user_id = ? ORDER BY s.created_at DESC`,
    )
    .all(req.user.id);
  res.json({ sessions });
});

router.get('/sessions/:id/messages', authRequired, (req, res) => {
  const session = db.prepare('SELECT * FROM ai_chat_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: 'Chat session not found.' } });
  if (session.user_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This chat belongs to another user.' } });
  const messages = db
    .prepare('SELECT * FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(session.id)
    .map((message) => ({ ...message, sources: safeJson(message.source_json, []) }));
  res.json({ session, messages });
});

router.put('/sessions/:id/mode', authRequired, (req, res) => {
  const mode = String(req.body.mode || '');
  if (!['beginner', 'intermediate', 'advanced'].includes(mode)) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown explanation mode.' } });
  }
  const session = db.prepare('SELECT * FROM ai_chat_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: 'Chat session not found.' } });
  if (session.user_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This chat belongs to another user.' } });
  db.prepare('UPDATE ai_chat_sessions SET mode = ? WHERE id = ?').run(mode, session.id);
  res.json({ session: { ...session, mode } });
});

router.post('/lectures/:id/summarize', authRequired, (req, res) => {
  const lecture = db
    .prepare('SELECT l.*, m.course_id FROM lectures l JOIN modules m ON m.id = l.module_id WHERE l.id = ?')
    .get(req.params.id);
  if (!lecture) return res.status(404).json({ error: { code: 'LECTURE_NOT_FOUND', message: 'Lecture not found.' } });
  const access = courseForUser(lecture.course_id, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error });
  const summary = summarizeLecture(lecture.id);
  if (!summary) return res.status(404).json({ error: { code: 'SUMMARY_NOT_FOUND', message: 'No transcript indexed for this lecture.' } });
  res.json(summary);
});

router.post('/lectures/:id/generate-quiz', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const lecture = db
    .prepare('SELECT l.*, m.course_id FROM lectures l JOIN modules m ON m.id = l.module_id WHERE l.id = ?')
    .get(req.params.id);
  if (!lecture) return res.status(404).json({ error: { code: 'LECTURE_NOT_FOUND', message: 'Lecture not found.' } });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(lecture.course_id);
  if (req.user.role !== 'admin' && course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only generate quizzes for your own courses.' } });
  }
  const draft = generateQuizDraft(lecture.id);
  if (!draft) return res.status(404).json({ error: { code: 'DRAFT_NOT_FOUND', message: 'Could not generate a draft.' } });
  const quiz = {
    id: id('quiz'),
    course_id: lecture.course_id,
    module_id: lecture.module_id,
    title: `AI draft: ${lecture.title}`,
    is_ai_generated: 1,
    generated_from_lecture_id: lecture.id,
    status: 'draft',
    created_at: now(),
  };
  db.prepare(
    'INSERT INTO quizzes (id, course_id, module_id, title, is_ai_generated, generated_from_lecture_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(quiz.id, quiz.course_id, quiz.module_id, quiz.title, 1, lecture.id, quiz.status, quiz.created_at);
  draft.questions.forEach((question, index) => {
    db.prepare(
      `INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options_json, correct_index, explanation, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id('question'),
      quiz.id,
      question.question_text,
      question.question_type,
      JSON.stringify(question.options),
      question.correct_index,
      question.explanation,
      index + 1,
    );
  });
  recordAudit(req.user.id, 'quiz.generated', 'quiz', quiz.id, { lecture_id: lecture.id });
  res.status(201).json({ quiz, questions: draft.questions });
});

router.get('/quizzes/drafts/me', authRequired, roleRequired('instructor', 'admin'), (req, res) => {
  const drafts = db
    .prepare(
      `SELECT q.*, c.title AS course_title,
              (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count
       FROM quizzes q JOIN courses c ON c.id = q.course_id
       WHERE q.status = 'draft' ${req.user.role === 'admin' ? '' : 'AND c.instructor_id = ?'}
       ORDER BY q.created_at DESC`,
    )
    .all(...(req.user.role === 'admin' ? [] : [req.user.id]));
  res.json({ drafts });
});

router.post('/modules/:id/flashcards', authRequired, (req, res) => {
  const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(req.params.id);
  if (!module) return res.status(404).json({ error: { code: 'MODULE_NOT_FOUND', message: 'Module not found.' } });
  const access = courseForUser(module.course_id, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error });
  const cards = generateFlashcards(module.course_id, module.id);
  cards.forEach((card) => {
    db.prepare(
      'INSERT INTO flashcards (id, module_id, course_id, question, answer, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id('flashcard'), module.id, module.course_id, card.question, card.answer, now());
  });
  res.status(201).json({ flashcards: cards });
});

router.get('/flashcards', authRequired, (req, res) => {
  const courseId = req.query.course_id;
  const cards = courseId
    ? db.prepare('SELECT * FROM flashcards WHERE course_id = ? ORDER BY created_at DESC').all(courseId)
    : db.prepare('SELECT * FROM flashcards ORDER BY created_at DESC LIMIT 50').all();
  res.json({ flashcards: cards });
});

router.post('/study-plan', authRequired, (req, res) => {
  const courseId = String(req.body.course_id || '');
  const access = courseForUser(courseId, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error });
  const plan = buildStudyPlan(req.user.id, courseId);
  res.status(201).json({ plan });
});

router.get('/study-plans/me', authRequired, (req, res) => {
  const plans = db
    .prepare(
      `SELECT sp.*, c.title AS course_title FROM study_plans sp LEFT JOIN courses c ON c.id = sp.course_id
       WHERE sp.user_id = ? ORDER BY sp.generated_at DESC`,
    )
    .all(req.user.id)
    .map((plan) => ({ ...plan, plan: safeJson(plan.plan_json, {}) }));
  res.json({ plans });
});

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export default router;
