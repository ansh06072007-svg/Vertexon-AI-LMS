import { db, id, now } from './db.mjs';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'by', 'can', 'do', 'does', 'for', 'from',
  'how', 'i', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'should', 'so', 'that', 'the',
  'their', 'there', 'this', 'to', 'was', 'we', 'what', 'when', 'where', 'which', 'why', 'with',
  'you', 'your', 'would', 'could', 'about', 'into', 'than', 'then', 'not', 'no', 'yes',
]);

const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

export function retrieveChunks(courseId, query, limit = 4) {
  const chunks = db
    .prepare(
      `SELECT dc.*, l.title AS lecture_title, l.duration_seconds
       FROM document_chunks dc
       LEFT JOIN lectures l ON l.id = dc.lecture_id
       WHERE dc.course_id = ?`,
    )
    .all(courseId);
  const queryTokens = tokenize(query);
  const querySet = new Set(queryTokens);
  return chunks
    .map((chunk) => {
      const chunkTokens = tokenize(chunk.chunk_text);
      const unique = new Set(chunkTokens);
      let overlap = 0;
      querySet.forEach((token) => {
        if (unique.has(token)) overlap += 1;
        // Small bonus for exact substring matches, which helps technical terms.
        else if (chunk.chunk_text.toLowerCase().includes(token)) overlap += 0.4;
      });
      return { ...chunk, score: overlap / Math.sqrt(Math.max(unique.size, 1)) };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function sourceFromChunk(chunk) {
  return {
    lecture_id: chunk.lecture_id,
    lecture_title: chunk.lecture_title || 'Course material',
    timestamp_seconds: chunk.timestamp_seconds || 0,
    snippet: chunk.chunk_text,
  };
}

function modeLead(mode) {
  if (mode === 'beginner') return 'Simple version: ';
  if (mode === 'advanced') return 'Advanced take: ';
  return '';
}

function customAnswer(message, chunks) {
  const q = message.toLowerCase();
  if (/(quick\s*sort|pivot|sorted input)/.test(q)) {
    return {
      reply:
        'On an already sorted array, choosing the first or last element as the pivot creates maximally unbalanced partitions: one side gets 0 elements and the other gets n − 1. The recurrence becomes T(n) = T(n − 1) + O(n), so the total cost is **O(n²)**.\n\nA randomized pivot or median-of-three keeps the expected running time at **O(n log n)**. The randomization is not about making every partition perfect — it is about making the probability of repeatedly bad partitions negligible.',
      sources: chunks.slice(0, 2).map(sourceFromChunk),
    };
  }
  if (/(dijkstra|min.?heap|shortest path|relaxation)/.test(q)) {
    return {
      reply:
        'Dijkstra needs non-negative edge weights because it settles a vertex once: when the minimum-distance vertex is extracted, its distance is treated as final. A negative edge can create a shorter path to an already-settled vertex, which breaks that greedy invariant.\n\nWith an **indexed binary min-heap**, each extraction and decrease-key costs O(log V). Every vertex is extracted once and each edge can trigger one relaxation, so the total cost is **O((V + E) log V)**. If negative edges exist, use **Bellman-Ford** instead — it supports them and can detect negative cycles.',
      sources: chunks.slice(0, 3).map(sourceFromChunk),
    };
  }
  if (/(bellman|negative cycle)/.test(q)) {
    return {
      reply:
        'Bellman-Ford relaxes every edge up to V − 1 times. That handles negative edge weights, which Dijkstra cannot. After those passes, run one extra relaxation: if any distance still improves, a negative cycle is reachable from the source. The time complexity is **O(VE)**.',
      sources: chunks.slice(0, 2).map(sourceFromChunk),
    };
  }
  if (/(resilien|circuit breaker|retry|outage|timeout)/.test(q)) {
    return {
      reply:
        'A resilient service assumes dependencies will fail. Use short timeouts, bounded retries with exponential backoff and jitter, circuit breakers, and idempotency keys. The goal is to stop a small dependency failure from becoming a cascading outage. Pair these patterns with request tracing and service-level indicators so you can see degradation before customers report it.',
      sources: chunks.slice(0, 2).map(sourceFromChunk),
    };
  }
  if (/(event|outbox|idempoten|broker)/.test(q)) {
    return {
      reply:
        'With at-least-once delivery, consumers must be idempotent because the same event can arrive more than once. The outbox pattern keeps the database write and the event publication consistent: write the event to an outbox table in the same transaction, then publish it asynchronously. Version your event schemas so consumers can evolve independently.',
      sources: chunks.slice(0, 2).map(sourceFromChunk),
    };
  }
  return null;
}

export function answerQuestion({ courseId, message, mode = 'intermediate' }) {
  const chunks = retrieveChunks(courseId, message, 4);
  if (!chunks.length) {
    return {
      reply:
        "I couldn't find a grounded passage for that question in this course's indexed material. Try asking about a specific lecture concept, or upload the relevant transcript so I can index it.",
      sources: [],
      mode,
    };
  }

  const custom = customAnswer(message, chunks);
  if (custom) return { ...custom, mode };

  const top = chunks.slice(0, 2);
  const body = top.map((chunk, index) => `${index + 1}. ${chunk.chunk_text}`).join('\n\n');
  return {
    reply:
      `${modeLead(mode)}Here is what your course material says about this:\n\n${body}\n\n` +
      'If you want, I can turn this into flashcards or a short practice quiz for the same lecture.',
    sources: top.map(sourceFromChunk),
    mode,
  };
}

export function summarizeLecture(lectureId) {
  const chunks = db
    .prepare(
      `SELECT dc.*, l.title AS lecture_title
       FROM document_chunks dc JOIN lectures l ON l.id = dc.lecture_id
       WHERE dc.lecture_id = ? ORDER BY dc.timestamp_seconds ASC`,
    )
    .all(lectureId);
  const lecture = db.prepare('SELECT * FROM lectures WHERE id = ?').get(lectureId);
  if (!lecture) return null;

  let points = chunks.map((chunk) => chunk.chunk_text);
  if (!points.length && lecture.transcript) {
    points = lecture.transcript
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  if (!points.length) {
    points = [`This lecture covers ${lecture.title}. Add a transcript to generate a richer summary.`];
  }
  return {
    lecture_id: lectureId,
    lecture_title: lecture.title,
    summary: points.slice(0, 4).join(' '),
    key_points: points.slice(0, 5),
    sources: chunks.slice(0, 4).map(sourceFromChunk),
  };
}

export function generateQuizDraft(lectureId) {
  const lecture = db.prepare('SELECT * FROM lectures WHERE id = ?').get(lectureId);
  if (!lecture) return null;
  const chunks = db
    .prepare('SELECT * FROM document_chunks WHERE lecture_id = ? ORDER BY timestamp_seconds ASC LIMIT 3')
    .all(lectureId);
  const facts = chunks.length
    ? chunks.map((chunk) => chunk.chunk_text)
    : [lecture.transcript || `The lecture introduces ${lecture.title}.`];

  const questions = facts.slice(0, 5).map((fact, index) => {
    const clean = fact.replace(/\s+/g, ' ').trim();
    const short = clean.length > 150 ? `${clean.slice(0, 147)}…` : clean;
    return {
      question_text: `Which statement is best supported by the lecture material? (${index + 1})`,
      question_type: 'mcq',
      options: [
        short,
        'The concept is only relevant when all inputs are empty.',
        'It can be replaced by any traversal without changing correctness.',
        'It guarantees constant-time performance for every graph.',
      ],
      correct_index: 0,
      explanation: `Grounded in ${lecture.title}: ${short}`,
    };
  });

  if (!questions.length) {
    questions.push({
      question_text: `What is the main topic of ${lecture.title}?`,
      question_type: 'mcq',
      options: [lecture.title, 'An unrelated algorithm', 'A frontend styling pattern', 'A database migration'],
      correct_index: 0,
      explanation: `This lecture is titled ${lecture.title}.`,
    });
  }
  return { lecture_id: lectureId, lecture_title: lecture.title, questions };
}

export function generateFlashcards(courseId, moduleId = null) {
  const rows = moduleId
    ? db
        .prepare(
          `SELECT dc.*, l.title AS lecture_title FROM document_chunks dc
           JOIN lectures l ON l.id = dc.lecture_id JOIN modules m ON m.id = l.module_id
           WHERE dc.course_id = ? AND m.id = ? LIMIT 6`,
        )
        .all(courseId, moduleId)
    : db.prepare('SELECT dc.*, l.title AS lecture_title FROM document_chunks dc WHERE dc.course_id = ? LIMIT 6').all(courseId);

  return rows.map((row, index) => ({
    id: `fc-generated-${index + 1}`,
    question: `What should you remember from “${row.lecture_title}”?`,
    answer: row.chunk_text,
    source: sourceFromChunk(row),
  }));
}

export function buildStudyPlan(userId, courseId) {
  const enrollment = db
    .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(userId, courseId);
  const attempts = db
    .prepare(
      `SELECT qa.*, q.title AS quiz_title FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id
       WHERE qa.user_id = ? AND q.course_id = ? ORDER BY qa.started_at DESC LIMIT 3`,
    )
    .all(userId, courseId);
  const progress = enrollment ? Math.round(enrollment.progress_percent) : 0;
  const weakest = attempts.length
    ? attempts.reduce((worst, attempt) => (attempt.score < (worst?.score ?? 101) ? attempt : worst), null)?.quiz_title
    : 'Graph Theory & Shortest Path';

  const plan = {
    course_id: courseId,
    generated_at: now(),
    focus: weakest,
    blocks: [
      { label: 'Review the weakest quiz topic', minutes: 15, status: 'ready' },
      { label: `Re-attempt ${weakest}`, minutes: 20, status: 'next' },
      { label: 'Finish the next lecture and write 3 notes', minutes: 30, status: progress > 50 ? 'ready' : 'locked' },
      { label: 'Generate flashcards and do a spaced review', minutes: 12, status: 'next' },
    ],
  };
  db.prepare('INSERT INTO study_plans (id, user_id, course_id, plan_json, generated_at) VALUES (?, ?, ?, ?, ?)').run(
    id('plan'),
    userId,
    courseId,
    JSON.stringify(plan),
    now(),
  );
  return plan;
}
