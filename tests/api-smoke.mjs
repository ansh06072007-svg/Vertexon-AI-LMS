import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:5199/api/v1';
const dbPath = join(root, 'server', 'data', 'smoke-test.db');
const outboxPath = join(root, 'server', 'data', 'smoke-mail-outbox.log');
let server;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // Server is still booting.
    }
    await sleep(200);
  }
  throw new Error('API server did not become ready on port 5199.');
}

async function request(path, { token, method = 'GET', body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Keep text for binary/text responses.
  }
  return { response, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login(email, password) {
  const { response, data } = await request('/auth/login', { method: 'POST', body: { email, password } });
  assert(response.ok, `Login failed for ${email}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function run() {
  console.log('Starting isolated API server…');
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: '5199',
      HOST: '127.0.0.1',
      DB_PATH: dbPath,
      MAIL_OUTBOX_LOG: outboxPath,
      JWT_ACCESS_SECRET: 'smoke-test-access',
      JWT_REFRESH_SECRET: 'smoke-test-refresh',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverError = '';
  server.stderr.on('data', (chunk) => {
    serverError += String(chunk);
  });
  await waitForServer();

  const results = [];
  const check = async (name, fn) => {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`  PASS  ${name}`);
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
      console.error(`  FAIL  ${name}\n        ${error.message}`);
    }
  };

  const student = await login('ananya@vertexon.ai', 'Student123!');
  const instructor = await login('rohit@vertexon.ai', 'Instructor123!');
  const admin = await login('meera@vertexon.ai', 'Admin123!');

  await check('health endpoint reports sqlite', async () => {
    const { response, data } = await request('/health');
    assert(response.ok && data.status === 'ok', 'Health check failed');
  });

  await check('student /auth/me returns seeded profile', async () => {
    const { response, data } = await request('/auth/me', { token: student.access_token });
    assert(response.ok && data.user.email === 'ananya@vertexon.ai', 'Unexpected /auth/me payload');
    assert(data.streak.current_streak >= 1, 'Expected a seeded streak');
  });

  await check('student dashboard aggregates enrollments', async () => {
    const { response, data } = await request('/dashboard/me', { token: student.access_token });
    assert(response.ok, 'Dashboard failed');
    assert(data.stats.enrolled_courses >= 1, 'Expected enrolled courses');
    assert(data.enrolled_courses.length >= 1, 'Expected enrollment rows');
  });

  await check('catalog search filters approved courses', async () => {
    const { response, data } = await request('/courses?q=algorithm', { token: student.access_token });
    assert(response.ok && data.courses.length >= 1, 'Expected a search result');
    assert(data.courses.every((course) => course.status === 'approved'), 'Students must not see unapproved courses');
  });

  let courseDetail;
  await check('course detail exposes modules and lectures', async () => {
    const { response, data } = await request('/courses/c-dsa', { token: student.access_token });
    assert(response.ok, 'Course detail failed');
    courseDetail = data;
    assert(data.modules.length >= 1 && data.modules[0].lectures.length >= 1, 'Expected curriculum');
  });

  const lectureId = courseDetail.modules[0].lectures[0].id;

  await check('student can save and delete a timestamped note', async () => {
    const created = await request(`/lectures/${lectureId}/notes`, {
      token: student.access_token,
      method: 'POST',
      body: { content: 'Smoke-test note', timestamp_seconds: 42 },
    });
    assert(created.response.status === 201, 'Note creation failed');
    const deleted = await request(`/notes/${created.data.note.id}`, { token: student.access_token, method: 'DELETE' });
    assert(deleted.response.status === 204, 'Note deletion failed');
  });

  await check('student can create and delete a bookmark', async () => {
    const created = await request(`/lectures/${lectureId}/bookmarks`, {
      token: student.access_token,
      method: 'POST',
      body: { timestamp_seconds: 61 },
    });
    assert(created.response.status === 201, 'Bookmark creation failed');
    const deleted = await request(`/bookmarks/${created.data.bookmark.id}`, {
      token: student.access_token,
      method: 'DELETE',
    });
    assert(deleted.response.status === 204, 'Bookmark deletion failed');
  });

  await check('AI tutor answers with course citations', async () => {
    const { response, data } = await request('/ai/chat', {
      token: student.access_token,
      method: 'POST',
      body: {
        course_id: 'c-dsa',
        message: 'Why does Dijkstra fail with negative edge weights?',
        mode: 'advanced',
      },
    });
    assert(response.ok, `AI chat failed: ${JSON.stringify(data)}`);
    assert(data.sources.length >= 1, 'Expected at least one source citation');
    assert(data.message.content.length > 40, 'Expected a substantive answer');
    assert(data.session.id, 'Expected a chat session');
  });

  await check('quiz attempt persists answers and score', async () => {
    const quiz = await request('/quizzes/q-dsa', { token: student.access_token });
    assert(quiz.response.ok, 'Quiz fetch failed');
    const attempt = await request('/quizzes/q-dsa/attempt', { token: student.access_token, method: 'POST' });
    assert(attempt.response.status === 201, 'Attempt creation failed');
    const answers = quiz.data.questions.map((question) => ({ question_id: question.id, selected_index: 0 }));
    const submitted = await request(`/quizzes/attempts/${attempt.data.attempt.id}/submit`, {
      token: student.access_token,
      method: 'POST',
      body: { answers },
    });
    assert(submitted.response.ok, 'Attempt submission failed');
    assert(submitted.data.review.length === quiz.data.questions.length, 'Expected review for every question');
    assert(typeof submitted.data.score === 'number', 'Expected a numeric score');
  });

  await check('assignment upload stores a submission', async () => {
    const assignments = await request('/assignments/me', { token: student.access_token });
    assert(assignments.response.ok && assignments.data.assignments.length >= 1, 'Expected assignments');
    const assignment = assignments.data.assignments[0];
    const form = new FormData();
    form.append('file', new Blob(['smoke-test submission'], { type: 'text/plain' }), 'smoke-test.txt');
    const submitted = await request(`/assignments/${assignment.id}/submit`, {
      token: student.access_token,
      method: 'POST',
      formData: form,
    });
    assert(submitted.response.status === 201, `Upload failed: ${JSON.stringify(submitted.data)}`);
    assert(submitted.data.submission.file_name === 'smoke-test.txt', 'Expected uploaded filename');
  });

  await check('certificate PDF downloads with a credential', async () => {
    const response = await fetch(`${base}/certificates/cert-ml/download`, {
      headers: { Authorization: `Bearer ${student.access_token}` },
    });
    assert(response.ok, `Certificate download failed: ${response.status}`);
    assert((response.headers.get('content-type') || '').includes('application/pdf'), 'Expected a PDF');
    const bytes = await response.arrayBuffer();
    assert(bytes.byteLength > 1000, 'Expected a non-empty PDF');
  });

  await check('student cannot open the admin console', async () => {
    const { response } = await request('/admin/overview', { token: student.access_token });
    assert(response.status === 403, `Expected 403, received ${response.status}`);
  });

  await check('instructor overview and analytics load', async () => {
    const overview = await request('/instructor/overview', { token: instructor.access_token });
    assert(overview.response.ok && overview.data.courses.length >= 1, 'Instructor overview failed');
    const analytics = await request('/instructor/analytics', { token: instructor.access_token });
    assert(analytics.response.ok && analytics.data.analytics.length >= 1, 'Analytics failed');
  });

  await check('instructor can generate and publish an AI quiz draft', async () => {
    const generated = await request(`/ai/lectures/${lectureId}/generate-quiz`, {
      token: instructor.access_token,
      method: 'POST',
    });
    assert(generated.response.status === 201, `Generation failed: ${JSON.stringify(generated.data)}`);
    const published = await request(`/instructor/quizzes/${generated.data.quiz.id}/publish`, {
      token: instructor.access_token,
      method: 'POST',
    });
    assert(published.response.ok, 'Publishing failed');
  });

  await check('instructor grading updates a submission', async () => {
    const submissions = await request('/instructor/submissions', { token: instructor.access_token });
    assert(submissions.response.ok, 'Instructor submissions failed');
    if (submissions.data.submissions.length > 0) {
      const submission = submissions.data.submissions[0];
      const graded = await request(`/submissions/${submission.id}/grade`, {
        token: instructor.access_token,
        method: 'PUT',
        body: { grade: 88, feedback: 'Clear structure; tighten the complexity analysis.' },
      });
      assert(graded.response.ok && graded.data.submission.grade === 88, 'Grade update failed');
    }
  });

  await check('instructor cannot access admin APIs', async () => {
    const { response } = await request('/admin/overview', { token: instructor.access_token });
    assert(response.status === 403, `Expected 403, received ${response.status}`);
  });

  await check('admin overview exposes approval and moderation queues', async () => {
    const { response, data } = await request('/admin/overview', { token: admin.access_token });
    assert(response.ok && data.stats.total_users >= 8, 'Admin overview failed');
    assert(Array.isArray(data.pending_courses), 'Expected pending courses');
    assert(Array.isArray(data.flagged_posts), 'Expected flagged posts');
  });

  await check('admin can approve a pending course', async () => {
    const pending = await request('/admin/courses/pending', { token: admin.access_token });
    assert(pending.response.ok && pending.data.courses.length >= 1, 'Expected a pending course');
    const course = pending.data.courses[0];
    const approved = await request(`/courses/${course.id}/approve`, {
      token: admin.access_token,
      method: 'POST',
      body: { decision: 'approved', comment: 'Smoke test approval' },
    });
    assert(approved.response.ok, 'Approval failed');
  });

  await check('admin can list users and dismiss a flagged post', async () => {
    const users = await request('/admin/users?role=student', { token: admin.access_token });
    assert(users.response.ok && users.data.users.length >= 1, 'User list failed');
    const flagged = await request('/admin/moderation/flagged', { token: admin.access_token });
    assert(flagged.response.ok, 'Flagged list failed');
    if (flagged.data.posts.length > 0) {
      const post = flagged.data.posts[0];
      const dismissed = await request(`/admin/moderation/posts/${post.id}`, {
        token: admin.access_token,
        method: 'PUT',
        body: { action: 'dismiss' },
      });
      assert(dismissed.response.ok, 'Moderation action failed');
    }
  });

  await check('new student registration returns a usable session', async () => {
    const created = await request('/auth/register', {
      method: 'POST',
      body: { full_name: 'Smoke Test Learner', email: `smoke-${Date.now()}@vertexon.ai`, password: 'TestPass123!' },
    });
    assert(created.response.status === 201, `Registration failed: ${JSON.stringify(created.data)}`);
    const me = await request('/auth/me', { token: created.data.access_token });
    assert(me.response.ok && me.data.user.role === 'student', 'New session failed');
  });

  await check('catalog supports rating, price, and sort filters', async () => {
    const filtered = await request('/courses?min_rating=4.8&price=free&sort=rating', {
      token: student.access_token,
    });
    assert(filtered.response.ok, 'Filtered catalog failed');
    assert(filtered.data.courses.length >= 1, 'Expected at least one free 4.8+ course');
    assert(
      filtered.data.courses.every(
        (course) => Number(course.rating) >= 4.8 && Number(course.price) === 0,
      ),
      'Catalog returned a course outside the requested filters',
    );
    const ratings = filtered.data.courses.map((course) => Number(course.rating));
    assert(
      ratings.every((rating, index) => index === 0 || ratings[index - 1] >= rating),
      'Rating sort is not descending',
    );
  });

  await check('quiz grades multi-select and short-answer questions', async () => {
    const quiz = await request('/quizzes/q-dsa', { token: student.access_token });
    const multi = quiz.data.questions.find((question) => question.id === 'qq-6');
    const short = quiz.data.questions.find((question) => question.id === 'qq-7');
    assert(multi?.question_type === 'multi_select', 'Expected a multi-select question');
    assert(short?.question_type === 'short_answer', 'Expected a short-answer question');
    const attempt = await request('/quizzes/q-dsa/attempt', {
      token: student.access_token,
      method: 'POST',
    });
    const answers = quiz.data.questions.map((question) => {
      if (question.id === 'qq-6') return { question_id: question.id, selected_indexes: [0, 2] };
      if (question.id === 'qq-7') return { question_id: question.id, text_answer: 'bellman ford' };
      return { question_id: question.id, selected_index: 0 };
    });
    const submitted = await request(`/quizzes/attempts/${attempt.data.attempt.id}/submit`, {
      token: student.access_token,
      method: 'POST',
      body: { answers },
    });
    assert(submitted.response.ok, 'Mixed-type quiz submission failed');
    const multiReview = submitted.data.review.find((item) => item.question_id === 'qq-6');
    const shortReview = submitted.data.review.find((item) => item.question_id === 'qq-7');
    assert(multiReview?.is_correct === true, 'Multi-select answer was not graded correctly');
    assert(shortReview?.is_correct === true, 'Short-answer answer was not graded correctly');
    assert(shortReview.selected_indexes.length === 0, 'Short answer should not have selected options');
  });

  await check('topic mastery is tracked after a quiz attempt', async () => {
    const mastery = await request('/mastery/me?course_id=c-dsa', { token: student.access_token });
    assert(mastery.response.ok && mastery.data.mastery.length >= 1, 'Expected topic mastery rows');
    assert(
      mastery.data.mastery.some((item) => item.topic === 'Advanced Graph Theory'),
      'Expected mastery for the quiz module topic',
    );
  });

  await check('instructor can upload lecture material and post an announcement', async () => {
    const form = new FormData();
    form.append('file', new Blob(['week 1 syllabus'], { type: 'text/plain' }), 'syllabus.txt');
    const upload = await request('/uploads/material', {
      token: instructor.access_token,
      method: 'POST',
      formData: form,
    });
    assert(upload.response.status === 201, `Material upload failed: ${JSON.stringify(upload.data)}`);
    assert(upload.data.file.url.startsWith('/uploads/'), 'Expected a served upload URL');

    const title = `Smoke announcement ${Date.now()}`;
    const announcement = await request('/courses/c-dsa/announcements', {
      token: instructor.access_token,
      method: 'POST',
      body: { title, content: 'Office hours move to Thursday at 7 PM.' },
    });
    assert(announcement.response.status === 201, 'Announcement creation failed');
    const visible = await request('/courses/c-dsa/announcements', { token: student.access_token });
    assert(
      visible.data.announcements.some((item) => item.title === title),
      'Student could not see the instructor announcement',
    );
  });

  await check('completing a course auto-issues a certificate', async () => {
    const created = await request('/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Certificate Smoke Learner',
        email: `cert-${Date.now()}@vertexon.ai`,
        password: 'TestPass123!',
      },
    });
    assert(created.response.status === 201, 'Could not create certificate test learner');
    const token = created.data.access_token;
    const enrolled = await request('/courses/c-ml/enroll', { token, method: 'POST' });
    assert(enrolled.response.status === 201, 'Certificate test enrollment failed');
    const detail = await request('/courses/c-ml', { token });
    const lectures = detail.data.modules.flatMap((module) => module.lectures);
    assert(lectures.length >= 1, 'Expected lectures in the certificate test course');
    let progress;
    for (const lecture of lectures) {
      progress = await request(`/lectures/${lecture.id}/progress`, {
        token,
        method: 'POST',
        body: { watched_seconds: lecture.duration_seconds, completed: true },
      });
      assert(progress.response.ok, 'Lesson completion failed');
    }
    assert(progress.data.progress === 100, 'Expected 100% course progress');
    assert(progress.data.certificate?.credential_id, 'Expected an automatically issued certificate');
    const certificates = await request('/certificates/me', { token });
    assert(
      certificates.data.certificates.some((certificate) => certificate.course_id === 'c-ml'),
      'Issued certificate was not persisted',
    );
  });

  await check('admin can delete and anonymize a learner account', async () => {
    const created = await request('/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Deletion Smoke Learner',
        email: `delete-${Date.now()}@vertexon.ai`,
        password: 'TestPass123!',
      },
    });
    assert(created.response.status === 201, 'Could not create deletion test learner');
    const deleted = await request(`/admin/users/${created.data.user.id}`, {
      token: admin.access_token,
      method: 'DELETE',
    });
    assert(deleted.response.ok && deleted.data.deleted, 'Admin deletion failed');
    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: created.data.user.email, password: 'TestPass123!' },
    });
    assert(login.response.status === 401, 'Deleted account should not be able to log in');
  });

  await check('recommendations use mastery, quiz difficulty, and category signals', async () => {
    const recommendations = await request('/recommendations/me', { token: student.access_token });
    assert(recommendations.response.ok, 'Recommendation endpoint failed');
    assert(
      recommendations.data.strategy === 'mastery-keywords+quiz-difficulty+category-affinity',
      'Expected the explainable recommendation strategy',
    );
    assert(recommendations.data.recommendations.length >= 1, 'Expected at least one recommendation');
    assert(
      recommendations.data.recommendations.every((item) => item.reason && Number(item.score) > 0),
      'Recommendations must include a reason and score',
    );
  });

  await check('email notifications are recorded in the local outbox', async () => {
    const outbox = await request('/admin/email-outbox', { token: admin.access_token });
    assert(outbox.response.ok, 'Email outbox failed');
    assert(outbox.data.adapter === 'local-outbox', 'Expected the local delivery adapter');
    assert(outbox.data.messages.length >= 1, 'Expected at least one delivered email');
    assert(outbox.data.messages.every((message) => message.recipient.includes('@')), 'Expected valid recipients');
  });

  const failed = results.filter((item) => !item.ok);
  console.log('');
  console.log(`${results.length - failed.length}/${results.length} smoke checks passed.`);
  if (serverError.trim()) {
    console.log('Server stderr (last 2000 chars):');
    console.log(serverError.slice(-2000));
  }
  if (failed.length) {
    console.error('Failed checks:', failed.map((item) => item.name).join(', '));
    process.exitCode = 1;
  }
}

try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill('SIGTERM');
    await sleep(400);
  }
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (existsSync(file)) {
      try {
        rmSync(file, { force: true });
      } catch {
        // Windows may briefly hold the sqlite handle; cleanup is best-effort.
      }
    }
  }
  if (existsSync(outboxPath)) {
    try {
      rmSync(outboxPath, { force: true });
    } catch {
      // Test log cleanup is best-effort.
    }
  }
}
