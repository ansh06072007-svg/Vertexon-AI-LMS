import { Router } from 'express';
import { db, id, now, recordAudit } from '../db.mjs';
import { authRequired } from '../auth.mjs';
import { awardBadge, notifyUser, recordQuizMastery } from '../accomplishments.mjs';

const router = Router();

const uniqueIndexes = (values) =>
  [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value >= 0))].sort((a, b) => a - b);

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

router.get('/:id', authRequired, (req, res) => {
  const quiz = db
    .prepare('SELECT q.*, c.title AS course_title, c.instructor_id FROM quizzes q JOIN courses c ON c.id = q.course_id WHERE q.id = ?')
    .get(req.params.id);
  if (!quiz) return res.status(404).json({ error: { code: 'QUIZ_NOT_FOUND', message: 'Quiz not found.' } });
  if (quiz.status !== 'approved' && req.user.role === 'student') {
    return res.status(404).json({ error: { code: 'QUIZ_NOT_FOUND', message: 'Quiz not available.' } });
  }
  const isStudent = req.user.role === 'student';
  const questions = db
    .prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC')
    .all(quiz.id)
    .map((question) => {
      const correctIndexes = uniqueIndexes(
        safeJson(question.correct_indexes_json, [Number(question.correct_index)]),
      );
      return {
        id: question.id,
        question_text: question.question_text,
        question_type: question.question_type,
        options: safeJson(question.options_json, []),
        explanation: isStudent ? undefined : question.explanation,
        order_index: question.order_index,
        ...(isStudent
          ? {}
          : {
              correct_index: Number(question.correct_index),
              correct_indexes: correctIndexes,
              accepted_answers: safeJson(question.accepted_answers_json, []),
            }),
      };
    });
  res.json({
    quiz: { ...quiz, question_count: questions.length },
    questions,
  });
});

router.post('/:id/attempt', authRequired, (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz || quiz.status !== 'approved') {
    return res.status(404).json({ error: { code: 'QUIZ_NOT_FOUND', message: 'Quiz not found.' } });
  }
  if (req.user.role === 'student') {
    const enrollment = db
      .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
      .get(req.user.id, quiz.course_id);
    if (!enrollment) return res.status(403).json({ error: { code: 'NOT_ENROLLED', message: 'Enroll in the course first.' } });
  }
  const total = db.prepare('SELECT COUNT(*) AS count FROM quiz_questions WHERE quiz_id = ?').get(quiz.id);
  const attempt = {
    id: id('attempt'),
    quiz_id: quiz.id,
    user_id: req.user.id,
    score: 0,
    correct_count: 0,
    total_count: Number(total.count),
    started_at: now(),
    submitted_at: null,
  };
  db.prepare(
    'INSERT INTO quiz_attempts (id, quiz_id, user_id, score, correct_count, total_count, started_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
  ).run(
    attempt.id,
    attempt.quiz_id,
    attempt.user_id,
    attempt.score,
    attempt.correct_count,
    attempt.total_count,
    attempt.started_at,
  );
  res.status(201).json({ attempt });
});

router.post('/attempts/:id/submit', authRequired, (req, res) => {
  const attempt = db
    .prepare(
      `SELECT qa.*, q.course_id, q.title AS quiz_title, q.module_id
       FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
       WHERE qa.id = ?`,
    )
    .get(req.params.id);
  if (!attempt) return res.status(404).json({ error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found.' } });
  if (attempt.user_id !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This attempt belongs to another user.' } });
  }
  if (attempt.submitted_at) {
    return res.status(409).json({ error: { code: 'ALREADY_SUBMITTED', message: 'This attempt was already submitted.' } });
  }
  const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC').all(attempt.quiz_id);
  const incoming = Array.isArray(req.body.answers) ? req.body.answers : [];
  const answerMap = new Map();
  incoming.forEach((answer) => {
    answerMap.set(String(answer.question_id), answer);
  });

  const review = [];
  let correctCount = 0;
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM quiz_answers WHERE attempt_id = ?').run(attempt.id);
    questions.forEach((question) => {
      const raw = answerMap.get(question.id) || {};
      const options = safeJson(question.options_json, []);
      const correctIndexes = uniqueIndexes(
        safeJson(question.correct_indexes_json, [Number(question.correct_index)]),
      );
      const acceptedAnswers = safeJson(question.accepted_answers_json, []);
      const questionType = question.question_type || 'mcq';
      let selectedIndex = null;
      let selectedIndexes = [];
      let textAnswer = '';
      let isCorrect = false;

      if (questionType === 'multi_select') {
        const proposed = Array.isArray(raw.selected_indexes)
          ? raw.selected_indexes
          : Number.isInteger(Number(raw.selected_index)) && Number(raw.selected_index) >= 0
            ? [raw.selected_index]
            : [];
        selectedIndexes = uniqueIndexes(proposed);
        selectedIndex = selectedIndexes[0] ?? null;
        isCorrect =
          selectedIndexes.length === correctIndexes.length &&
          selectedIndexes.every((value, index) => value === correctIndexes[index]);
      } else if (questionType === 'short_answer') {
        textAnswer = String(raw.text_answer || '').trim().slice(0, 2000);
        const accepted = acceptedAnswers.map(normalizeText).filter(Boolean);
        const fallback = normalizeText(options[correctIndexes[0]] || '');
        if (!accepted.length && fallback) accepted.push(fallback);
        isCorrect = Boolean(textAnswer) && accepted.includes(normalizeText(textAnswer));
      } else {
        const proposed = Number(raw.selected_index);
        selectedIndex = Number.isInteger(proposed) && proposed >= 0 ? proposed : null;
        isCorrect = selectedIndex !== null && selectedIndex === correctIndexes[0];
      }

      if (isCorrect) correctCount += 1;
      db.prepare(
        `INSERT INTO quiz_answers
         (id, attempt_id, question_id, selected_index, selected_indexes_json, text_answer, is_correct)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id('answer'),
        attempt.id,
        question.id,
        selectedIndex,
        selectedIndexes.length ? JSON.stringify(selectedIndexes) : null,
        textAnswer || null,
        isCorrect ? 1 : 0,
      );
      review.push({
        question_id: question.id,
        question_text: question.question_text,
        question_type: questionType,
        options,
        selected_index: selectedIndex,
        selected_indexes: selectedIndexes,
        text_answer: textAnswer,
        correct_index: correctIndexes[0] ?? null,
        correct_indexes: correctIndexes,
        accepted_answers: acceptedAnswers,
        is_correct: isCorrect,
        explanation: question.explanation,
      });
    });
    const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    db.prepare(
      'UPDATE quiz_attempts SET score = ?, correct_count = ?, total_count = ?, submitted_at = ? WHERE id = ?',
    ).run(score, correctCount, questions.length, now(), attempt.id);

    if (score === 100) {
      awardBadge(req.user.id, 'b-perfect');
    }
    const highScores = db
      .prepare(
        'SELECT COUNT(*) AS count FROM quiz_attempts WHERE user_id = ? AND submitted_at IS NOT NULL AND score >= 90',
      )
      .get(req.user.id);
    if (Number(highScores.count) >= 5) {
      awardBadge(req.user.id, 'b-quiz-master');
    }
    const module = attempt.module_id
      ? db.prepare('SELECT title FROM modules WHERE id = ?').get(attempt.module_id)
      : null;
    const topic = (module?.title || attempt.quiz_title || 'Course practice').replace(/^Practice Quiz:\s*/i, '');
    const mastery = recordQuizMastery(req.user.id, attempt.course_id, topic, score);
    notifyUser(
      req.user.id,
      'Quiz graded',
      `${attempt.quiz_title}: ${score}% (${correctCount}/${questions.length} correct).`,
      { email: true, emailSubject: `Your quiz result: ${attempt.quiz_title}` },
    );
    recordAudit(req.user.id, 'quiz.submitted', 'quiz_attempt', attempt.id, { score });
    db.exec('COMMIT');

    res.json({
      attempt: { ...attempt, score, correct_count: correctCount, total_count: questions.length, submitted_at: now() },
      score,
      correct_count: correctCount,
      total_count: questions.length,
      mastery,
      review,
      recommendation:
        score >= 80
          ? 'Strong attempt. Move to the next module and try the challenge set.'
          : 'Review the explanations for the missed questions, then generate a focused study plan in the AI Tutor.',
    });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
});

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export default router;
