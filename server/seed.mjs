import bcrypt from 'bcryptjs';
import { db, id, now } from './db.mjs';

const BASE = '2026-10-22T09:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;
const future = (days) => new Date(Date.parse(BASE) + days * DAY).toISOString();

const users = [
  {
    id: 'u-ananya',
    full_name: 'Ananya Sharma',
    email: 'ananya@vertexon.ai',
    password: 'Student123!',
    role: 'student',
    headline: 'B.Tech CSE · Final year',
  },
  {
    id: 'u-rohit',
    full_name: 'Rohit Verma',
    email: 'rohit@vertexon.ai',
    password: 'Instructor123!',
    role: 'instructor',
    headline: 'DSA & Systems instructor',
  },
  {
    id: 'u-meera',
    full_name: 'Meera Iyer',
    email: 'meera@vertexon.ai',
    password: 'Admin123!',
    role: 'admin',
    headline: 'Platform administrator',
  },
  {
    id: 'u-priya',
    full_name: 'Priya Mehta',
    email: 'priya@vertexon.ai',
    password: 'Student123!',
    role: 'student',
    headline: 'B.Tech IT · Third year',
  },
  {
    id: 'u-rohan',
    full_name: 'Rohan Gupta',
    email: 'rohan@vertexon.ai',
    password: 'Student123!',
    role: 'student',
    headline: 'Full-stack developer',
  },
  {
    id: 'u-aisha',
    full_name: 'Aisha Khan',
    email: 'aisha@vertexon.ai',
    password: 'Instructor123!',
    role: 'instructor',
    headline: 'Machine learning instructor',
  },
  {
    id: 'u-neha',
    full_name: 'Neha Kapoor',
    email: 'neha@vertexon.ai',
    password: 'Instructor123!',
    role: 'instructor',
    headline: 'Product design lead',
  },
  {
    id: 'u-arjun',
    full_name: 'Arjun Nair',
    email: 'arjun@vertexon.ai',
    password: 'Instructor123!',
    role: 'instructor',
    headline: 'Cloud & platform engineer',
  },
];

const courses = [
  {
    id: 'c-dsa',
    instructor_id: 'u-rohit',
    title: 'Data Structures & Algorithms in Python',
    description:
      'Build interview-ready problem solving skills with complexity analysis, trees, graphs, dynamic programming, and pattern-based practice.',
    category: 'Data',
    difficulty: 'Intermediate',
    thumbnail_url: null,
    price: 0,
    status: 'approved',
    rating: 4.9,
    lessons_count: 22,
    glyph: '</>',
    tone: 'from-[#231451] via-[#141a3c] to-[#0d1424]',
    tag_class: 'text-primary-200 border-primary-300/20 bg-primary-500/10',
  },
  {
    id: 'c-fullstack',
    instructor_id: 'u-rohit',
    title: 'Full-Stack System Design & Microservices',
    description:
      'Design resilient APIs, event-driven services, caching layers, and production-grade deployment patterns.',
    category: 'Development',
    difficulty: 'Advanced',
    thumbnail_url: null,
    price: 2499,
    status: 'approved',
    rating: 4.8,
    lessons_count: 31,
    glyph: '{ }',
    tone: 'from-[#0b2b2b] via-[#0d1a21] to-[#0e1019]',
    tag_class: 'text-teal-300 border-teal2/20 bg-teal2/10',
  },
  {
    id: 'c-sql',
    instructor_id: 'u-meera',
    title: 'SQL & Data Modeling for Analytics',
    description:
      'Go from SELECT statements to dimensional models, window functions, query tuning, and analytics-ready schemas.',
    category: 'Data',
    difficulty: 'Beginner',
    thumbnail_url: null,
    price: 1299,
    status: 'approved',
    rating: 4.7,
    lessons_count: 16,
    glyph: 'SQL',
    tone: 'from-[#0e2438] via-[#101b2b] to-[#0d1119]',
    tag_class: 'text-sky-300 border-sky-300/20 bg-sky-400/10',
  },
  {
    id: 'c-ml',
    instructor_id: 'u-aisha',
    title: 'Machine Learning Foundations',
    description:
      'Understand the math and intuition behind supervised learning, model evaluation, and responsible ML workflows.',
    category: 'AI/ML',
    difficulty: 'Beginner',
    thumbnail_url: null,
    price: 0,
    status: 'approved',
    rating: 4.9,
    lessons_count: 18,
    glyph: 'AI',
    tone: 'from-[#2b1a3d] via-[#1b1428] to-[#0f0d17]',
    tag_class: 'text-fuchsia-300 border-fuchsia-300/20 bg-fuchsia-400/10',
  },
  {
    id: 'c-design',
    instructor_id: 'u-neha',
    title: 'Product Design Systems with Figma',
    description:
      'Create reusable components, accessibility patterns, and a visual language that scales across product teams.',
    category: 'Design',
    difficulty: 'Beginner',
    thumbnail_url: null,
    price: 1499,
    status: 'approved',
    rating: 4.7,
    lessons_count: 14,
    glyph: '◈',
    tone: 'from-[#2c1a1d] via-[#21141a] to-[#110d13]',
    tag_class: 'text-rose-300 border-rose-300/20 bg-rose-400/10',
  },
  {
    id: 'c-devops',
    instructor_id: 'u-arjun',
    title: 'Cloud Native DevOps with Kubernetes',
    description:
      'Ship containers with confidence using Kubernetes, observability, zero-downtime releases, and infrastructure as code.',
    category: 'Development',
    difficulty: 'Advanced',
    thumbnail_url: null,
    price: 1999,
    status: 'approved',
    rating: 4.8,
    lessons_count: 26,
    glyph: 'K8s',
    tone: 'from-[#14223a] via-[#121a2c] to-[#0c0f18]',
    tag_class: 'text-blue-300 border-blue-300/20 bg-blue-400/10',
  },
  {
    id: 'c-genai',
    instructor_id: 'u-aisha',
    title: 'Generative AI for Product Teams',
    description:
      'A practical introduction to LLM product patterns, prompt evaluation, guardrails, and retrieval-augmented generation.',
    category: 'AI/ML',
    difficulty: 'Intermediate',
    thumbnail_url: null,
    price: 2999,
    status: 'pending',
    rating: 0,
    lessons_count: 12,
    glyph: 'LLM',
    tone: 'from-[#1d1a3d] via-[#17142a] to-[#0e0d17]',
    tag_class: 'text-indigo-300 border-indigo-300/20 bg-indigo-400/10',
  },
];

const modules = [
  { id: 'm-dsa-1', course_id: 'c-dsa', title: 'Foundations & Sorting', order_index: 1 },
  { id: 'm-dsa-2', course_id: 'c-dsa', title: 'Trees & Graphs', order_index: 2 },
  { id: 'm-dsa-3', course_id: 'c-dsa', title: 'Advanced Graph Theory', order_index: 3 },
  { id: 'm-fs-1', course_id: 'c-fullstack', title: 'Architecture Foundations', order_index: 1 },
  { id: 'm-fs-2', course_id: 'c-fullstack', title: 'Event-Driven Systems', order_index: 2 },
  { id: 'm-sql-1', course_id: 'c-sql', title: 'Relational Modeling', order_index: 1 },
  { id: 'm-ml-1', course_id: 'c-ml', title: 'Supervised Learning', order_index: 1 },
  { id: 'm-ml-2', course_id: 'c-ml', title: 'Model Evaluation', order_index: 2 },
  { id: 'm-design-1', course_id: 'c-design', title: 'Design Tokens', order_index: 1 },
  { id: 'm-devops-1', course_id: 'c-devops', title: 'Containers & Orchestration', order_index: 1 },
];

const lectures = [
  {
    id: 'l-dsa-01',
    module_id: 'm-dsa-1',
    title: 'Big-O & Complexity Refresher',
    duration_seconds: 1440,
    order_index: 1,
    transcript:
      'Big-O describes the growth rate of an algorithm as input size grows. We focus on the dominant term and ignore constants. Sorting has a lower bound of O(n log n) for comparison-based algorithms. Space complexity matters when recursion or auxiliary arrays are involved.',
    resource_urls: JSON.stringify(['BigO_Cheatsheet.pdf']),
  },
  {
    id: 'l-dsa-04',
    module_id: 'm-dsa-1',
    title: 'Quicksort Deep Dive',
    duration_seconds: 1938,
    order_index: 2,
    transcript:
      'Quicksort partitions an array around a pivot. Choosing the first or last element as the pivot degrades to O(n squared) on already sorted input because every partition is maximally unbalanced. Randomized pivot selection or median-of-three keeps the expected running time at O(n log n). The partition step is linear, and the recursion tree depth determines the total comparison count.',
    resource_urls: JSON.stringify(['Quicksort_Slides.pdf', 'quicksort_starter.py']),
  },
  {
    id: 'l-dsa-11',
    module_id: 'm-dsa-2',
    title: 'Topological Sort',
    duration_seconds: 1800,
    order_index: 1,
    transcript:
      'Topological sorting produces a linear ordering of vertices in a directed acyclic graph. Kahn algorithm repeatedly removes vertices with zero indegree. DFS-based topological sort uses finishing times. Cycle detection is essential because a topological ordering exists only for a DAG.',
    resource_urls: JSON.stringify(['TopologicalSort_Notes.pdf']),
  },
  {
    id: 'l-dsa-12',
    module_id: 'm-dsa-3',
    title: 'Graph Shortest Path & Min-Heap Optimization',
    duration_seconds: 2170,
    order_index: 1,
    transcript:
      'Dijkstra algorithm finds shortest paths from a source in a non-negative weighted graph. Without a heap, extracting the minimum takes O(V) each time and the total cost becomes O(V squared). An indexed binary min-heap reduces extraction and decrease-key to O(log V), so the total cost is O((V + E) log V). The greedy invariant says that once a vertex is extracted, its distance is final. Negative edge weights break this invariant because a later path can improve a settled vertex.',
    resource_urls: JSON.stringify(['Dijkstra_Graphs.pdf', 'dijkstra_starter.py']),
  },
  {
    id: 'l-dsa-13',
    module_id: 'm-dsa-3',
    title: 'Bellman-Ford & Negative Cycles',
    duration_seconds: 1694,
    order_index: 2,
    transcript:
      'Bellman-Ford relaxes every edge V minus one times. It supports negative edge weights and can detect a negative cycle by checking whether an additional relaxation is still possible. Its time complexity is O(VE). Use Bellman-Ford when negative edges are present, and Dijkstra when all edge weights are non-negative.',
    resource_urls: JSON.stringify(['BellmanFord_Notes.pdf']),
  },
  {
    id: 'l-fs-01',
    module_id: 'm-fs-1',
    title: 'Designing for Failure',
    duration_seconds: 1980,
    order_index: 1,
    transcript:
      'A resilient service assumes dependencies will fail. Timeouts, bounded retries with exponential backoff and jitter, circuit breakers, and idempotency keys prevent small failures from becoming cascading outages. Observability must include request tracing, structured logs, and service-level indicators.',
    resource_urls: JSON.stringify(['Resilience_Patterns.pdf']),
  },
  {
    id: 'l-fs-02',
    module_id: 'm-fs-2',
    title: 'Event-Driven Architecture',
    duration_seconds: 2240,
    order_index: 1,
    transcript:
      'Event-driven systems decouple producers and consumers through a broker. At-least-once delivery means consumers must be idempotent. The outbox pattern keeps database writes and event publication consistent. Schema evolution requires versioned events and backwards-compatible consumers.',
    resource_urls: JSON.stringify(['EventDriven.pdf']),
  },
  {
    id: 'l-sql-01',
    module_id: 'm-sql-1',
    title: 'Joins, Grain & Dimensional Modeling',
    duration_seconds: 1820,
    order_index: 1,
    transcript:
      'Always declare the grain of a fact table before choosing dimensions. A left join preserves rows from the left input, while an inner join filters unmatched rows. Window functions compute rankings and running totals without collapsing the result set. Index selectivity and query shape determine whether the planner can use an index.',
    resource_urls: JSON.stringify(['SQL_Modeling.pdf']),
  },
  {
    id: 'l-ml-01',
    module_id: 'm-ml-1',
    title: 'Bias, Variance & the Train/Test Split',
    duration_seconds: 2010,
    order_index: 1,
    transcript:
      'A model that memorizes the training set has low bias and high variance. A model that is too simple has high bias and underfits. Cross-validation gives a more stable estimate of generalization. Leakage happens when information from the test set influences training.',
    resource_urls: JSON.stringify(['ML_Workflow.pdf']),
  },
  {
    id: 'l-ml-02',
    module_id: 'm-ml-2',
    title: 'Precision, Recall & Thresholds',
    duration_seconds: 1760,
    order_index: 1,
    transcript:
      'Precision is the fraction of positive predictions that are correct. Recall is the fraction of actual positives that were found. The classifier threshold trades one for the other. The PR curve is more informative than accuracy when classes are imbalanced.',
    resource_urls: JSON.stringify(['Evaluation_Metrics.pdf']),
  },
];

const chunks = [
  {
    id: 'ch-qs-1',
    course_id: 'c-dsa',
    lecture_id: 'l-dsa-04',
    chunk_text:
      'Choosing the first or last element as the pivot produces maximally unbalanced partitions when the input is already sorted. One side receives zero elements and the other receives n minus one.',
    timestamp_seconds: 842,
  },
  {
    id: 'ch-qs-2',
    course_id: 'c-dsa',
    lecture_id: 'l-dsa-04',
    chunk_text:
      'With unbalanced partitions, the recurrence is T(n) = T(n-1) + O(n), which expands to O(n squared) comparisons. Randomized pivots or median-of-three restore the expected O(n log n) cost.',
    timestamp_seconds: 934,
  },
  {
    id: 'ch-dj-1',
    course_id: 'c-dsa',
    lecture_id: 'l-dsa-12',
    chunk_text:
      'An indexed binary min-heap lets Dijkstra extract the minimum and decrease a key in O(log V). Every vertex is extracted once and each edge can trigger one relaxation, giving O((V + E) log V).',
    timestamp_seconds: 765,
  },
  {
    id: 'ch-dj-2',
    course_id: 'c-dsa',
    lecture_id: 'l-dsa-12',
    chunk_text:
      'Dijkstra requires non-negative edge weights because the greedy invariant is that a settled vertex has its final shortest distance. Negative weights can create a shorter path to an already settled vertex.',
    timestamp_seconds: 872,
  },
  {
    id: 'ch-heap-1',
    course_id: 'c-dsa',
    lecture_id: 'l-dsa-12',
    chunk_text:
      'In a zero-indexed binary heap, the left child of index i is 2i + 1, the right child is 2i + 2, and the parent is floor((i - 1) / 2).',
    timestamp_seconds: 765,
  },
  {
    id: 'ch-bf-1',
    course_id: 'c-dsa',
    lecture_id: 'l-dsa-13',
    chunk_text:
      'Bellman-Ford relaxes all edges V minus one times, supports negative edge weights, and detects negative cycles with one extra pass. Its complexity is O(VE).',
    timestamp_seconds: 610,
  },
  {
    id: 'ch-fs-1',
    course_id: 'c-fullstack',
    lecture_id: 'l-fs-01',
    chunk_text:
      'Timeouts, bounded retries, circuit breakers, and idempotency keys prevent a failing dependency from turning into a cascading outage.',
    timestamp_seconds: 420,
  },
  {
    id: 'ch-fs-2',
    course_id: 'c-fullstack',
    lecture_id: 'l-fs-02',
    chunk_text:
      'At-least-once delivery requires idempotent consumers. The outbox pattern keeps a database write and its event publication consistent.',
    timestamp_seconds: 515,
  },
  {
    id: 'ch-sql-1',
    course_id: 'c-sql',
    lecture_id: 'l-sql-01',
    chunk_text:
      'Declare the grain of a fact table before selecting dimensions. Window functions compute running totals without collapsing rows.',
    timestamp_seconds: 340,
  },
  {
    id: 'ch-ml-1',
    course_id: 'c-ml',
    lecture_id: 'l-ml-01',
    chunk_text:
      'High variance means the model memorizes training data. Cross-validation estimates generalization and helps detect data leakage.',
    timestamp_seconds: 510,
  },
];

const enrollments = [
  { id: 'e-ananya-dsa', user_id: 'u-ananya', course_id: 'c-dsa', progress_percent: 64, enrolled_at: '2026-08-12T08:00:00.000Z' },
  { id: 'e-ananya-fs', user_id: 'u-ananya', course_id: 'c-fullstack', progress_percent: 28, enrolled_at: '2026-08-26T08:00:00.000Z' },
  { id: 'e-ananya-sql', user_id: 'u-ananya', course_id: 'c-sql', progress_percent: 12, enrolled_at: '2026-09-18T08:00:00.000Z' },
  { id: 'e-ananya-ml', user_id: 'u-ananya', course_id: 'c-ml', progress_percent: 100, enrolled_at: '2026-06-02T08:00:00.000Z' },
  { id: 'e-priya-dsa', user_id: 'u-priya', course_id: 'c-dsa', progress_percent: 42, enrolled_at: '2026-09-01T08:00:00.000Z' },
  { id: 'e-rohan-fs', user_id: 'u-rohan', course_id: 'c-fullstack', progress_percent: 55, enrolled_at: '2026-08-20T08:00:00.000Z' },
  { id: 'e-priya-design', user_id: 'u-priya', course_id: 'c-design', progress_percent: 9, enrolled_at: '2026-10-01T08:00:00.000Z' },
];

const quizQuestions = [
  {
    id: 'qq-1',
    question: "What is the time complexity of Dijkstra's algorithm using a binary min-heap and an adjacency list?",
    options: ['O(V²)', 'O((V + E) log V)', 'O(E²)', 'O(V log V)'],
    correct: 1,
    explanation:
      'Each vertex is extracted once in O(log V), and each edge can trigger a decrease-key in O(log V), giving O((V + E) log V).',
  },
  {
    id: 'qq-2',
    question: "Which graph property is required for Dijkstra's algorithm to guarantee correct shortest paths?",
    options: ['Non-negative edge weights', 'No directed cycles', 'The graph must be a DAG', 'All edge weights must be equal'],
    correct: 0,
    explanation:
      'Dijkstra relies on the greedy invariant that settled distances never improve. Negative weights can violate that invariant.',
  },
  {
    id: 'qq-3',
    question:
      'Given a directed weighted graph with 6 vertices and non-negative edges, what is the maximum number of successful edge relaxations when running Dijkstra with an indexed min-heap?',
    options: ['At most |V| times', 'At most |E| times', 'O(|V|²) times', 'Exactly |V| + |E| times'],
    correct: 1,
    explanation:
      'With an indexed min-heap, each vertex is settled once. Its outgoing edges are inspected once at that point, so successful relaxations are bounded by |E|.',
  },
  {
    id: 'qq-4',
    question: 'In a 0-indexed array implementation of a binary min-heap, which index holds the right child of the node at index i?',
    options: ['2i + 2', '2i + 1', '2i', '(i − 1) / 2'],
    correct: 0,
    explanation: 'In a 0-indexed heap: left child = 2i + 1, right child = 2i + 2, parent = (i − 1) / 2.',
  },
  {
    id: 'qq-5',
    question: 'A graph contains negative edge weights but no negative cycles. Which shortest-path algorithm should you use?',
    options: ['Bellman-Ford', 'Dijkstra', 'Breadth-first search', "Prim's algorithm"],
    correct: 0,
    explanation:
      'Bellman-Ford handles negative edges and detects negative cycles by relaxing every edge up to V − 1 times.',
  },
  {
    id: 'qq-6',
    question: 'Which statements about Dijkstra with a binary min-heap are true? Select all that apply.',
    type: 'multi_select',
    options: [
      'Each vertex is extracted from the heap at most once',
      'Negative edge weights are supported without any change',
      'Decrease-key operations cost O(log V)',
      'The algorithm can detect negative cycles',
    ],
    correct: 0,
    correctIndexes: [0, 2],
    explanation:
      'Dijkstra settles each vertex once and uses the heap for O(log V) extraction and decrease-key. Negative edges break its greedy invariant, and negative-cycle detection belongs to Bellman-Ford.',
  },
  {
    id: 'qq-7',
    question: 'Name the shortest-path algorithm that supports negative edge weights and can detect negative cycles.',
    type: 'short_answer',
    options: [],
    correct: 0,
    acceptedAnswers: ['Bellman-Ford', 'Bellman Ford', 'bellman-ford'],
    explanation:
      'Bellman-Ford relaxes all edges V − 1 times; if another relaxation is still possible, a negative cycle exists.',
  },
];

export async function seedDatabase() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (Number(existing.count) > 0) return { seeded: false };

  const passwordHashes = await Promise.all(users.map((user) => bcrypt.hash(user.password, 10)));
  const insert = (table, row) => {
    const keys = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(
      ...keys.map((key) => (typeof row[key] === 'object' && row[key] !== null ? JSON.stringify(row[key]) : row[key])),
    );
  };
  const insertMany = (table, rows) => rows.forEach((row) => insert(table, row));

  db.exec('BEGIN');
  try {
    users.forEach((user, index) => {
      insert('users', {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        password_hash: passwordHashes[index],
        role: user.role,
        status: 'active',
        headline: user.headline,
        avatar_url: null,
        created_at: BASE,
      });
    });

    insertMany(
      'courses',
      courses.map((course) => ({
        ...course,
        created_at: BASE,
        updated_at: BASE,
      })),
    );
    insertMany('modules', modules);
    insertMany(
      'lectures',
      lectures.map((lecture) => ({
        ...lecture,
        video_url: 'https://storage.vertexon.ai/courses/demo/master.m3u8',
        resource_urls: lecture.resource_urls ?? JSON.stringify([]),
        created_at: BASE,
      })),
    );
    insertMany('enrollments', enrollments.map((enrollment) => ({ ...enrollment, enrolled_at: enrollment.enrolled_at ?? BASE })));
    insertMany('document_chunks', chunks.map((chunk) => ({ ...chunk, embedding_json: null, created_at: BASE })));

    insertMany('notes', [
      {
        id: 'n1',
        user_id: 'u-ananya',
        lecture_id: 'l-dsa-12',
        timestamp_seconds: 639,
        content: 'Remember edge relaxation condition: dist[v] > dist[u] + weight(u, v)',
        created_at: BASE,
        updated_at: BASE,
      },
      {
        id: 'n2',
        user_id: 'u-ananya',
        lecture_id: 'l-dsa-12',
        timestamp_seconds: 765,
        content: 'Indexed min-heap → O(log V) decrease-key. Map each vertex to its heap position.',
        created_at: BASE,
        updated_at: BASE,
      },
    ]);
    insert('bookmarks', {
      id: 'b1',
      user_id: 'u-ananya',
      lecture_id: 'l-dsa-12',
      timestamp_seconds: 872,
      created_at: BASE,
    });
    insertMany('lecture_progress', [
      {
        id: 'lp-1',
        enrollment_id: 'e-ananya-dsa',
        lecture_id: 'l-dsa-01',
        watched_seconds: 1440,
        completed: 1,
        last_watched_at: BASE,
      },
      {
        id: 'lp-2',
        enrollment_id: 'e-ananya-dsa',
        lecture_id: 'l-dsa-04',
        watched_seconds: 1938,
        completed: 1,
        last_watched_at: BASE,
      },
      {
        id: 'lp-3',
        enrollment_id: 'e-ananya-dsa',
        lecture_id: 'l-dsa-12',
        watched_seconds: 872,
        completed: 0,
        last_watched_at: BASE,
      },
    ]);

    insertMany('quizzes', [
      {
        id: 'q-dsa',
        course_id: 'c-dsa',
        module_id: 'm-dsa-3',
        title: 'Practice Quiz: Graph Theory & Shortest Path',
        is_ai_generated: 0,
        generated_from_lecture_id: null,
        status: 'approved',
        created_at: BASE,
      },
    ]);
    insertMany(
      'quiz_questions',
      quizQuestions.map((question, index) => ({
        id: question.id,
        quiz_id: 'q-dsa',
        question_text: question.question,
        question_type: question.type || 'mcq',
        options_json: JSON.stringify(question.options),
        correct_index: question.correct,
        correct_indexes_json:
          question.correctIndexes !== undefined
            ? JSON.stringify(question.correctIndexes)
            : JSON.stringify([question.correct]),
        accepted_answers_json: JSON.stringify(question.acceptedAnswers || []),
        explanation: question.explanation,
        order_index: index + 1,
      })),
    );
    insert('quiz_attempts', {
      id: 'qa-ananya-1',
      quiz_id: 'q-dsa',
      user_id: 'u-ananya',
      score: 80,
      correct_count: 4,
      total_count: 5,
      started_at: future(-2),
      submitted_at: future(-2),
    });

    insertMany('assignments', [
      {
        id: 'a-dsa-1',
        course_id: 'c-dsa',
        title: 'Implement Dijkstra with an Indexed Min-Heap',
        instructions:
          'Submit a Python implementation that returns shortest distances from a source vertex. Include a note on time complexity and test coverage.',
        rubric: JSON.stringify({ correctness: 40, complexity: 30, tests: 20, clarity: 10 }),
        due_date: future(5),
        created_at: BASE,
      },
      {
        id: 'a-dsa-2',
        course_id: 'c-dsa',
        title: 'Graph Traversal Write-up',
        instructions: 'Compare BFS, DFS, Dijkstra, and Bellman-Ford on a graph of your choice. Explain when each is appropriate.',
        rubric: JSON.stringify({ accuracy: 50, examples: 30, clarity: 20 }),
        due_date: future(10),
        created_at: BASE,
      },
      {
        id: 'a-fs-1',
        course_id: 'c-fullstack',
        title: 'Design a Resilient Order Service',
        instructions: 'Write a one-page design for an order service that can survive a payment-provider outage.',
        rubric: JSON.stringify({ patterns: 40, failure_modes: 30, observability: 30 }),
        due_date: future(8),
        created_at: BASE,
      },
    ]);
    insertMany('assignment_submissions', [
      {
        id: 's-dsa-1',
        assignment_id: 'a-dsa-1',
        user_id: 'u-ananya',
        file_url: '/uploads/demo-dijkstra.py',
        file_name: 'dijkstra_min_heap.py',
        submitted_at: future(-3),
        grade: 92,
        feedback: 'Clean heap implementation. Add one more test for disconnected graphs before the final submission.',
        status: 'graded',
      },
      {
        id: 's-dsa-2',
        assignment_id: 'a-dsa-1',
        user_id: 'u-priya',
        file_url: '/uploads/demo-dijkstra-priya.zip',
        file_name: 'priya_dijkstra.zip',
        submitted_at: future(-1),
        grade: null,
        feedback: null,
        status: 'submitted',
      },
    ]);

    insertMany('badges', [
      { id: 'b-first', name: 'First Course', description: 'Completed your first course', icon: 'trophy', criteria: 'course_complete' },
      { id: 'b-streak', name: '7-Day Streak', description: 'Seven days of consistent learning', icon: 'flame', criteria: 'streak_7' },
      { id: 'b-perfect', name: 'Perfect Score', description: '100% on a graded quiz', icon: 'target', criteria: 'quiz_100' },
      { id: 'b-fast', name: 'Fast Learner', description: 'Finish 3 modules in one week', icon: 'zap', criteria: 'modules_3_week' },
      { id: 'b-contributor', name: 'Top Contributor', description: '20 helpful forum answers', icon: 'users', criteria: 'forum_answers_20' },
      { id: 'b-quiz-master', name: 'Quiz Master', description: 'Score 90%+ on five quizzes', icon: 'crown', criteria: 'quiz_90_x5' },
    ]);
    insertMany('user_badges', [
      { user_id: 'u-ananya', badge_id: 'b-first', earned_at: '2026-09-01T08:00:00.000Z' },
      { user_id: 'u-ananya', badge_id: 'b-streak', earned_at: '2026-10-22T08:00:00.000Z' },
      { user_id: 'u-ananya', badge_id: 'b-perfect', earned_at: '2026-10-14T08:00:00.000Z' },
    ]);
    insertMany('topic_mastery', [
      {
        id: 'mastery-ananya-graphs',
        user_id: 'u-ananya',
        course_id: 'c-dsa',
        topic: 'Advanced Graph Theory',
        mastery: 80,
        attempts_count: 1,
        updated_at: BASE,
      },
      {
        id: 'mastery-ananya-trees',
        user_id: 'u-ananya',
        course_id: 'c-dsa',
        topic: 'Trees & Graphs',
        mastery: 64,
        attempts_count: 2,
        updated_at: BASE,
      },
      {
        id: 'mastery-ananya-sorting',
        user_id: 'u-ananya',
        course_id: 'c-dsa',
        topic: 'Foundations & Sorting',
        mastery: 92,
        attempts_count: 3,
        updated_at: BASE,
      },
    ]);
    insertMany('streaks', [
      { user_id: 'u-ananya', current_streak: 7, longest_streak: 14, last_active_date: '2026-10-22' },
      { user_id: 'u-priya', current_streak: 4, longest_streak: 9, last_active_date: '2026-10-22' },
      { user_id: 'u-rohan', current_streak: 3, longest_streak: 5, last_active_date: '2026-10-21' },
    ]);
    insert('certificates', {
      id: 'cert-ml',
      user_id: 'u-ananya',
      course_id: 'c-ml',
      certificate_url: '/api/v1/certificates/cert-ml/download',
      credential_id: 'VX-ML-2481',
      issued_at: '2026-05-12T08:00:00.000Z',
    });

    insertMany('discussion_threads', [
      {
        id: 't-pivot',
        course_id: 'c-dsa',
        created_by: 'u-priya',
        title: 'How do you choose the right pivot for quicksort?',
        created_at: future(-2),
      },
      {
        id: 't-dijkstra',
        course_id: 'c-dsa',
        created_by: 'u-rohan',
        title: 'Why does Dijkstra fail with negative weights?',
        created_at: future(-1),
      },
      {
        id: 't-resilience',
        course_id: 'c-fullstack',
        created_by: 'u-rohan',
        title: 'Circuit breaker vs retry budget',
        created_at: future(-1),
      },
      {
        id: 't-flagged',
        course_id: 'c-dsa',
        created_by: 'u-rohan',
        title: 'Assignment solution sharing',
        created_at: future(-1),
      },
    ]);
    insertMany('discussion_posts', [
      {
        id: 'p-1',
        thread_id: 't-pivot',
        user_id: 'u-priya',
        content: 'For an already sorted array, the first element pivot seems to make quicksort slow. Should we always randomize?',
        is_flagged: 0,
        created_at: future(-2),
      },
      {
        id: 'p-2',
        thread_id: 't-pivot',
        user_id: 'u-rohit',
        content:
          'Randomizing gives the expected O(n log n) bound and is a good default. Median-of-three is a deterministic alternative that handles sorted inputs well.',
        is_flagged: 0,
        created_at: future(-2),
      },
      {
        id: 'p-3',
        thread_id: 't-dijkstra',
        user_id: 'u-rohan',
        content: 'Can a negative edge improve a vertex that Dijkstra has already settled?',
        is_flagged: 0,
        created_at: future(-1),
      },
      {
        id: 'p-4',
        thread_id: 't-dijkstra',
        user_id: 'u-rohit',
        content:
          'Yes. The greedy invariant assumes non-negative edges, so a later relaxation can invalidate a settled distance. Use Bellman-Ford when negative edges are present.',
        is_flagged: 0,
        created_at: future(-1),
      },
      {
        id: 'p-5',
        thread_id: 't-resilience',
        user_id: 'u-rohan',
        content: 'A retry budget feels like it overlaps with a circuit breaker. Do we need both?',
        is_flagged: 0,
        created_at: future(-1),
      },
      {
        id: 'p-6',
        thread_id: 't-flagged',
        user_id: 'u-rohan',
        content: 'Here is a copy of the assignment solution, use it if you are stuck: https://example.com/leaked-solution',
        is_flagged: 1,
        created_at: future(-1),
      },
    ]);

    insertMany('announcements', [
      {
        id: 'ann-1',
        course_id: 'c-dsa',
        posted_by: 'u-rohit',
        title: 'Midterm submission deadline extended',
        content:
          'The midterm submission deadline has been extended to Friday, 11:59 PM. Office hours move to Thursday 7 PM.',
        created_at: future(-1),
      },
      {
        id: 'ann-2',
        course_id: 'c-fullstack',
        posted_by: 'u-rohit',
        title: 'New resilience case study',
        content: 'A new case study on graceful degradation has been added to Module 2.',
        created_at: future(-2),
      },
    ]);

    insertMany('notifications', [
      {
        id: 'notif-1',
        user_id: 'u-ananya',
        title: 'Quiz graded · Graph Theory practice',
        body: 'You scored 80%. Review heap indexing before your next attempt.',
        is_read: 0,
        created_at: future(-1),
      },
      {
        id: 'notif-2',
        user_id: 'u-ananya',
        title: 'Assignment feedback ready',
        body: 'Rohit Verma left feedback on your Dijkstra implementation.',
        is_read: 0,
        created_at: future(-2),
      },
      {
        id: 'notif-3',
        user_id: 'u-ananya',
        title: 'Certificado disponible',
        body: 'Your Machine Learning Foundations certificate is ready to download.',
        is_read: 1,
        created_at: future(-4),
      },
      {
        id: 'notif-4',
        user_id: 'u-rohit',
        title: 'New submission to review',
        body: 'Priya Mehta submitted the Dijkstra assignment.',
        is_read: 0,
        created_at: future(-1),
      },
      {
        id: 'notif-5',
        user_id: 'u-meera',
        title: 'Course awaiting approval',
        body: 'Generative AI for Product Teams is waiting for your review.',
        is_read: 0,
        created_at: future(-2),
      },
    ]);

    insertMany('course_approvals', [
      ...courses
        .filter((course) => course.status === 'approved')
        .map((course, index) => ({
          id: `ca-${index + 1}`,
          course_id: course.id,
          reviewed_by: 'u-meera',
          decision: 'approved',
          comment: 'Meets publishing standards.',
          reviewed_at: '2026-08-01T08:00:00.000Z',
        })),
    ]);

    insertMany('payments', [
      {
        id: 'pay-1',
        user_id: 'u-priya',
        course_id: 'c-fullstack',
        amount: 2499,
        status: 'success',
        created_at: future(-7),
      },
      {
        id: 'pay-2',
        user_id: 'u-rohan',
        course_id: 'c-devops',
        amount: 1999,
        status: 'success',
        created_at: future(-5),
      },
      {
        id: 'pay-3',
        user_id: 'u-priya',
        course_id: 'c-design',
        amount: 1499,
        status: 'success',
        created_at: future(-3),
      },
    ]);

    insertMany('recommendations', [
      {
        id: 'rec-1',
        user_id: 'u-ananya',
        recommended_course_id: 'c-design',
        reason: 'Pair your graph theory work with a design systems foundation.',
        score: 88,
        created_at: BASE,
      },
      {
        id: 'rec-2',
        user_id: 'u-ananya',
        recommended_course_id: 'c-devops',
        reason: 'Your systems design progress suggests a strong next step.',
        score: 81,
        created_at: BASE,
      },
    ]);

    insert('study_plans', {
      id: 'plan-ananya',
      user_id: 'u-ananya',
      course_id: 'c-dsa',
      plan_json: JSON.stringify({
        focus: 'Heap indexing and graph relaxations',
        blocks: [
          { label: 'Review heap indexing', minutes: 12, status: 'ready' },
          { label: 'Re-attempt 5 graph questions', minutes: 18, status: 'next' },
          { label: 'Finish Bellman-Ford lesson', minutes: 28, status: 'locked' },
        ],
      }),
      generated_at: BASE,
    });
    insertMany('flashcards', [
      {
        id: 'fc-1',
        module_id: 'm-dsa-3',
        course_id: 'c-dsa',
        question: 'What is the time complexity of Dijkstra with an indexed min-heap?',
        answer: 'O((V + E) log V).',
        created_at: BASE,
      },
      {
        id: 'fc-2',
        module_id: 'm-dsa-3',
        course_id: 'c-dsa',
        question: 'When does quicksort degrade to O(n²)?',
        answer: 'When partitions are maximally unbalanced, such as sorted input with a first/last pivot.',
        created_at: BASE,
      },
      {
        id: 'fc-3',
        module_id: 'm-dsa-3',
        course_id: 'c-dsa',
        question: 'Which algorithm handles negative edge weights?',
        answer: 'Bellman-Ford, which also detects negative cycles.',
        created_at: BASE,
      },
    ]);

    insertMany('audit_logs', [
      {
        id: 'audit-1',
        actor_id: 'u-meera',
        action: 'course.approved',
        entity: 'course',
        entity_id: 'c-dsa',
        metadata: JSON.stringify({ title: courses[0].title }),
        created_at: '2026-08-01T08:00:00.000Z',
      },
      {
        id: 'audit-2',
        actor_id: 'u-meera',
        action: 'course.approved',
        entity: 'course',
        entity_id: 'c-ml',
        metadata: JSON.stringify({ title: 'Machine Learning Foundations' }),
        created_at: '2026-08-01T08:00:00.000Z',
      },
    ]);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { seeded: true };
}
