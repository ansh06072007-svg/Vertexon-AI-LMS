export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
  topic: string;
};

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    topic: 'Dijkstra complexity',
    prompt: "What is the time complexity of Dijkstra's algorithm using a binary min-heap and an adjacency list?",
    options: ['O(V²)', 'O((V + E) log V)', 'O(E²)', 'O(V log V)'],
    correct: 1,
    explanation:
      'Each vertex is extracted once in O(log V), and each edge can trigger a decrease-key in O(log V), giving O((V + E) log V).',
  },
  {
    id: 'q2',
    topic: 'Algorithm preconditions',
    prompt: "Which graph property is required for Dijkstra's algorithm to guarantee correct shortest paths?",
    options: ['Non-negative edge weights', 'No directed cycles', 'The graph must be a DAG', 'All edge weights must be equal'],
    correct: 0,
    explanation:
      'Dijkstra relies on the greedy invariant that settled distances never improve. Negative weights can violate that invariant.',
  },
  {
    id: 'q3',
    topic: 'Edge relaxation',
    prompt:
      "Given a directed weighted graph with 6 vertices and non-negative edges, what is the maximum number of times an edge relaxation operation can be performed when running Dijkstra's algorithm with an indexed min-heap?",
    options: ['At most |V| times', 'At most |E| times', 'O(|V|²) times', 'Exactly |V| + |E| times'],
    correct: 1,
    explanation:
      'With an indexed min-heap, each vertex is settled once. Its outgoing edges are inspected once at that point, so successful relaxations are bounded by |E|.',
  },
  {
    id: 'q4',
    topic: 'Heap indexing',
    prompt: 'In a 0-indexed array implementation of a binary min-heap, which index holds the right child of the node at index i?',
    options: ['2i + 2', '2i + 1', '2i', '(i − 1) / 2'],
    correct: 0,
    explanation:
      'In a 0-indexed heap: left child = 2i + 1, right child = 2i + 2, parent = (i − 1) / 2.',
  },
  {
    id: 'q5',
    topic: 'Algorithm selection',
    prompt: 'A graph contains negative edge weights but no negative cycles. Which shortest-path algorithm should you use?',
    options: ['Bellman-Ford', 'Dijkstra', 'Breadth-first search', "Prim's algorithm"],
    correct: 0,
    explanation:
      'Bellman-Ford handles negative edges and detects negative cycles by relaxing every edge up to V − 1 times.',
  },
];
