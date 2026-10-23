import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Compass,
  Crosshair,
  Flame,
  Layers,
  Loader2,
  Megaphone,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import ProgressRing from '../components/ProgressRing';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';

type ApiCourse = {
  id: string;
  course_id: string;
  title: string;
  category: string;
  difficulty: string;
  progress: number;
  lessons_count: number;
  glyph: string;
  tone: string;
  tag_class: string;
};

type Assignment = {
  id: string;
  title: string;
  course_title: string;
  due_date: string;
  status: string | null;
  grade: number | null;
};

type Recommendation = {
  id: string;
  recommended_course_id: string;
  title: string;
  category: string;
  difficulty: string;
  reason: string;
  score: number;
  glyph: string;
  tone: string;
  tag_class: string;
};

type DashboardData = {
  user: { id: string; full_name: string; role: string };
  streak: { current_streak: number; longest_streak: number };
  stats: {
    enrolled_courses: number;
    completed_courses: number;
    completed_lessons: number;
    hours_learned: number;
    daily_minutes: number;
    daily_target: number;
  };
  enrolled_courses: ApiCourse[];
  continue_learning: ApiCourse | null;
  recommendations: Recommendation[];
  leaderboard: Array<{ id: string; full_name: string; current_streak: number; points: number }>;
  certificates: Array<{ id: string; course_title: string; credential_id: string }>;
  recent_attempts: Array<{ id: string; score: number; quiz_title: string; submitted_at: string | null }>;
};

type Gamification = {
  xp: number;
  level: number;
  quiz_attempts: number;
};

const courseThemes: Record<string, { tone: string; border: string; glyphClass: string }> = {
  'c-dsa': { tone: 'from-[#241751] via-[#16162f] to-[#0e1224]', border: 'border-primary-400/15', glyphClass: 'text-primary-300/60' },
  'c-fullstack': { tone: 'from-[#0b2c2b] via-[#0d1a21] to-[#0f1219]', border: 'border-teal2/15', glyphClass: 'text-teal2/60' },
  'c-sql': { tone: 'from-[#0e2438] via-[#101b2b] to-[#0d1119]', border: 'border-sky-400/15', glyphClass: 'text-sky-300/55' },
  'c-ml': { tone: 'from-[#2b1a3d] via-[#1c1428] to-[#100d17]', border: 'border-fuchsia-400/15', glyphClass: 'text-fuchsia-300/55' },
};

function themeFor(courseId: string) {
  return courseThemes[courseId] || { tone: 'from-[#171126] via-[#120f1d] to-[#0d0b14]', border: 'border-primary-400/15', glyphClass: 'text-primary-300/55' };
}

function dueLabel(date: string) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

const insights = [
  {
    title: 'Explain Dijkstra step-by-step',
    description: 'A Socratic walkthrough grounded in your lecture transcript.',
    icon: Crosshair,
    tone: 'border-primary-400/20 bg-primary-500/[0.09] text-primary-200',
    action: 'tutor',
  },
  {
    title: 'Generate 5 quick flashcards',
    description: 'Build a spaced-repetition deck from Module 3.',
    icon: Layers,
    tone: 'border-teal2/20 bg-teal2/[0.07] text-teal-300',
    action: 'flashcards',
  },
  {
    title: 'Start a 5-min practice quiz',
    description: 'Adaptive questions tuned to your mastery score.',
    icon: Zap,
    tone: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-300',
    action: 'quiz',
  },
] as const;

const activity = [
  { day: 'Mon', value: 58, minutes: 34 },
  { day: 'Tue', value: 76, minutes: 46 },
  { day: 'Wed', value: 46, minutes: 28 },
  { day: 'Thu', value: 88, minutes: 53, today: true },
  { day: 'Fri', value: 64, minutes: 38 },
  { day: 'Sat', value: 40, minutes: 24 },
  { day: 'Sun', value: 52, minutes: 31 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [gamification, setGamification] = useState<Gamification | null>(null);
  const [instructors, setInstructors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<DashboardData>('/dashboard/me'),
      api<{ assignments: Assignment[] }>('/assignments/me'),
      api<Gamification>('/gamification/me'),
      api<{ enrollments: Array<{ course_id: string; instructor_name: string }> }>('/enrollments/me'),
    ])
      .then(([dashboardData, assignmentData, gameData, enrollmentData]) => {
        setData(dashboardData);
        setAssignments(assignmentData.assignments);
        setGamification(gameData);
        setInstructors(
          Object.fromEntries(enrollmentData.enrollments.map((item) => [item.course_id, item.instructor_name])),
        );
      })
      .catch((caught) => showToast(errorMessage(caught)))
      .finally(() => setLoading(false));
  }, []);

  const courses = data?.enrolled_courses || [];
  const currentCourse = data?.continue_learning || courses.find((course) => course.progress < 100) || courses[0];
  const currentTheme = themeFor(currentCourse?.course_id || 'c-dsa');
  const firstName = data?.user.full_name.split(' ')[0] || user?.full_name.split(' ')[0] || 'learner';
  const currentStreak = data?.streak.current_streak || 0;
  const longestStreak = data?.streak.longest_streak || 0;
  const dailyMinutes = data?.stats.daily_minutes || 0;
  const dailyTarget = data?.stats.daily_target || 60;
  const dailyPercent = Math.min(100, Math.round((dailyMinutes / dailyTarget) * 100));
  const activeCourses = courses.filter((course) => course.progress < 100).length;
  const nextAssignment = assignments.find((assignment) => !assignment.status) || assignments[0];
  const recentAttempts = data?.recent_attempts || [];
  const averageScore = recentAttempts.length
    ? Math.round(recentAttempts.reduce((total, attempt) => total + Number(attempt.score), 0) / recentAttempts.length)
    : 0;
  const recommendation = data?.recommendations[0];
  const livePlan = [
    currentCourse
      ? {
          id: 'lesson',
          title: `Resume ${currentCourse.title}`,
          detail: `${currentCourse.category} · ${currentCourse.progress}% complete`,
          meta: `${Math.max(0, currentCourse.lessons_count - Math.round((currentCourse.lessons_count * currentCourse.progress) / 100))} left`,
          state: 'current',
          path: `/lesson?course=${currentCourse.course_id}`,
        }
      : {
          id: 'lesson',
          title: 'Find your first course',
          detail: 'Browse the catalog and start learning',
          meta: 'Start',
          state: 'current',
          path: '/learn',
        },
    nextAssignment
      ? {
          id: 'assignment',
          title: nextAssignment.title,
          detail: nextAssignment.course_title,
          meta: dueLabel(nextAssignment.due_date),
          state: nextAssignment.status === 'graded' ? 'done' : 'pending',
          path: '/assignments',
        }
      : {
          id: 'assignment',
          title: 'No pending assignments',
          detail: 'You are all caught up',
          meta: 'Clear',
          state: 'done',
          path: '/assignments',
        },
    {
      id: 'quiz',
      title: 'Practice quiz: Graph theory',
      detail: '5 adaptive questions with explanations',
      meta: '5 min',
      state: 'pending',
      path: '/quiz',
    },
  ];

  if (loading) {
    return (
      <div className="mx-auto grid min-h-[60vh] w-full max-w-[1440px] place-items-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary-300/60" />
          <p className="mt-3 text-[11px] text-white/35">Loading your learning dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-white/30">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Thursday, 22 October 2026
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
            <span className="font-medium text-emerald-300/70">Week 4 of 16</span>
          </div>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Welcome back, {firstName} <span className="inline-block origin-[70%_70%] animate-wave">👋</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-white/40">
            {activeCourses
              ? `You have ${activeCourses} active ${activeCourses === 1 ? 'course' : 'courses'}${nextAssignment ? ` and “${nextAssignment.title}” is ${dueLabel(nextAssignment.due_date).toLowerCase()}` : ''}. Keep the momentum — your AI study plan is ready.`
              : 'Browse the catalog and enroll in your first course to start a learning streak.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/learn')}
            className="btn-ghost h-10 px-4 text-[12px]"
          >
            <Compass className="h-4 w-4" />
            Browse courses
          </button>
          <button
            onClick={() => navigate(currentCourse ? `/lesson?course=${currentCourse.course_id}` : '/learn')}
            className="btn-primary h-10 px-4 text-[12px]"
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            Resume learning
          </button>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          onClick={() => showToast(`Streak details · ${currentStreak} days active, personal best ${longestStreak} days.`)}
          className="group relative overflow-hidden rounded-2xl border border-orange-400/15 bg-gradient-to-br from-[#291723] via-[#1c1220] to-[#100d17] p-4 text-left transition hover:border-orange-400/25"
        >
          <div className="pointer-events-none absolute -right-6 -top-10 h-24 w-24 rounded-full bg-orange-500/15 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-orange-400/20 bg-orange-400/10">
              <Flame className="h-4 w-4 fill-orange-400/30 text-orange-400" />
            </span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-emerald-300">
              {currentStreak > 0 ? 'Active' : 'Start today'}
            </span>
          </div>
          <p className="relative mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Current streak</p>
          <div className="relative mt-1 flex items-end gap-1.5">
            <p className="font-display text-[26px] font-bold leading-none text-white">{currentStreak}</p>
            <p className="mb-0.5 text-[11px] text-white/30">days</p>
          </div>
          <p className="relative mt-1.5 text-[10px] text-white/30">Personal best: {longestStreak} days</p>
        </button>

        <button
          onClick={() => showToast(`Study target · ${dailyMinutes} of ${dailyTarget} minutes completed today.`)}
          className="group flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#100d19] p-4 text-left transition hover:border-primary-400/20"
        >
          <div>
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary-400/15 bg-primary-500/[0.09]">
              <Target className="h-4 w-4 text-primary-300" />
            </span>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Daily study target</p>
            <div className="mt-1 flex items-end gap-1">
              <p className="font-display text-[24px] font-bold leading-none text-white">{dailyMinutes}</p>
              <p className="mb-0.5 text-[11px] text-white/25">/ {dailyTarget} min</p>
            </div>
            <p className="mt-1.5 text-[10px] text-white/30">
              {dailyMinutes >= dailyTarget ? 'Daily goal complete' : `${dailyTarget - dailyMinutes} minutes to your daily goal`}
            </p>
          </div>
          <ProgressRing value={dailyPercent} size={52} stroke={4} caption="Today" />
        </button>

        <button
          onClick={() => navigate('/learn')}
          className="group rounded-2xl border border-white/[0.06] bg-[#100d19] p-4 text-left transition hover:border-teal2/20"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-teal2/15 bg-teal2/[0.07]">
              <BookOpen className="h-4 w-4 text-teal-300" />
            </span>
            <ChevronRight className="h-4 w-4 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-white/35" />
          </div>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Active courses</p>
          <div className="mt-1 flex items-end gap-1">
            <p className="font-display text-[26px] font-bold leading-none text-white">{courses.length}</p>
            <p className="mb-0.5 text-[11px] text-white/25">enrolled</p>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="flex -space-x-1.5">
              {courses.slice(0, 4).map((course, index) => (
                <span
                  key={course.id}
                  title={course.title}
                  className={`grid h-5 w-5 place-items-center rounded-full border border-[#100d19] text-[5px] font-bold ${
                    ['bg-primary-500/40 text-primary-100', 'bg-teal2/30 text-teal-100', 'bg-sky-500/30 text-sky-100', 'bg-fuchsia-500/30 text-fuchsia-100'][index]
                  }`}
                >
                  {course.title[0]}
                </span>
              ))}
            </span>
            <span className="text-[10px] text-white/30">
              {activeCourses} in progress · {courses.length - activeCourses} completed
            </span>
          </div>
        </button>

        <button
          onClick={() => navigate('/quiz')}
          className="group rounded-2xl border border-white/[0.06] bg-[#100d19] p-4 text-left transition hover:border-primary-400/20"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-400/15 bg-amber-400/[0.07]">
              <TrendingUp className="h-4 w-4 text-amber-300" />
            </span>
            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2 py-1 text-[8px] font-medium text-emerald-300">
              {gamification?.quiz_attempts || 0} {gamification?.quiz_attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </div>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Avg. quiz score</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex items-end gap-1">
              <p className="font-display text-[26px] font-bold leading-none text-white">{averageScore || '—'}</p>
              <p className="mb-0.5 text-[11px] text-white/25">{averageScore ? '%' : ''}</p>
            </div>
            <svg viewBox="0 0 72 24" className="h-6 w-[72px]" aria-hidden="true">
              <path d="M1 19 11 16 21 17 31 11 41 13 51 7 61 9 71 3" fill="none" stroke="rgba(167,139,250,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 19 11 16 21 17 31 11 41 13 51 7 61 9 71 3V24H1Z" fill="url(#spark-fill)" opacity="0.25" />
              <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#a78bfa" />
                  <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <p className="mt-1.5 text-[10px] text-white/30">
            {recentAttempts[0]
              ? `Last quiz: ${Math.round(recentAttempts[0].score)}% · ${recentAttempts[0].quiz_title}`
              : 'No graded attempts yet · start a practice quiz'}
          </p>
        </button>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#171126] via-[#120f1d] to-[#0d0b14]">
            <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-teal2/20 bg-teal2/[0.08] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-teal-300">
                    {currentCourse ? 'In progress' : 'Start learning'}
                  </span>
                  {nextAssignment && (
                    <span className="flex items-center gap-1.5 rounded-md border border-rose-400/15 bg-rose-500/[0.07] px-2 py-1 text-[9px] font-medium text-rose-300">
                      <Clock className="h-3 w-3" />
                      {dueLabel(nextAssignment.due_date)}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 font-display text-[22px] font-semibold leading-[1.3] tracking-[-0.025em] text-white sm:text-[24px]">
                  {currentCourse?.title || 'Find your next course'}
                </h2>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11.5px] text-white/40">
                  <span className="flex items-center gap-1.5 text-primary-200/75">
                    <BookOpen className="h-3.5 w-3.5" />
                    {currentCourse ? `${currentCourse.category} · ${currentCourse.difficulty}` : 'Browse the course catalog'}
                  </span>
                  {currentCourse && (
                    <>
                      <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
                      <span className="flex items-center gap-1.5">
                        <Avatar name={instructors[currentCourse.course_id] || 'Vertexon instructor'} size={18} />
                        {instructors[currentCourse.course_id] || 'Vertexon instructor'}
                        <BadgeCheck className="h-3 w-3 text-sky-400" />
                      </span>
                    </>
                  )}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/35">
                      {currentCourse
                        ? `${Math.round((currentCourse.lessons_count * currentCourse.progress) / 100)} of ${currentCourse.lessons_count} lessons completed`
                        : 'No course selected yet'}
                    </span>
                    <span className="font-semibold text-primary-200">{currentCourse?.progress || 0}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal2 via-primary-400 to-primary-300 shadow-[0_0_14px_rgba(139,92,246,0.5)]"
                      style={{ width: `${currentCourse?.progress || 0}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => navigate(currentCourse ? `/lesson?course=${currentCourse.course_id}` : '/learn')}
                    className="btn-primary h-10 px-4 text-[12px]"
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15">
                      <Play className="h-2.5 w-2.5 fill-white text-white" />
                    </span>
                    Resume lecture
                  </button>
                  <button
                    onClick={() => {
                      if (!currentCourse) navigate('/learn');
                      else showToast(`${currentCourse.title} syllabus · ${currentCourse.lessons_count} lessons.`);
                    }}
                    className="btn-ghost h-10 px-4 text-[12px]"
                  >
                    View syllabus
                  </button>
                  <span className="ml-auto hidden items-center gap-1.5 text-[10px] text-white/25 sm:flex">
                    <Clock className="h-3 w-3" /> {data?.stats.hours_learned || 0}h learned
                  </span>
                </div>
              </div>

              <div className="relative hidden w-[285px] shrink-0 self-stretch overflow-hidden rounded-xl border border-white/[0.08] bg-[#08060f] lg:block">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />
                <div className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full bg-primary-500/25 blur-3xl" />
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1">
                  <span className="h-1 w-1 animate-pulse-soft rounded-full bg-rose-400" />
                  <span className="text-[7px] font-semibold uppercase tracking-[0.12em] text-white/35">Next lesson</span>
                </div>
                <div className="relative px-4 pt-11 font-mono text-[8.5px] leading-[1.9] text-white/30">
                  <p><span className="text-teal-300/50"># Dijkstra with indexed heap</span></p>
                  <p>dist[source] = <span className="text-amber-200/70">0</span></p>
                  <p>heap = [(0, source)]</p>
                  <p className="rounded bg-primary-500/10 px-1 text-primary-200/60">if d + w &lt; dist[v]:</p>
                  <p>　　dist[v] = d + w</p>
                  <p>　　heappush(heap, (dist[v], v))</p>
                </div>
                <svg viewBox="0 0 220 90" className="absolute bottom-9 left-3 right-3 h-[86px] w-[calc(100%-24px)]" aria-hidden="true">
                  <g stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none">
                    <path d="M28 20 80 12 126 34 184 24 160 68 88 76 34 54Z" />
                    <path d="M80 12 74 48 88 76" />
                    <path d="M126 34 74 48 160 68" />
                  </g>
                  <g stroke="rgba(45,212,191,0.6)" strokeWidth="1.5" fill="none">
                    <path d="M28 20 80 12 126 34 74 48 160 68" />
                  </g>
                  <g fill="#0d0b16" stroke="#6d5bd0" strokeWidth="1">
                    <circle cx="28" cy="20" r="5.5" />
                    <circle cx="80" cy="12" r="5.5" />
                    <circle cx="126" cy="34" r="5.5" />
                    <circle cx="184" cy="24" r="5.5" />
                    <circle cx="160" cy="68" r="5.5" />
                    <circle cx="88" cy="76" r="5.5" />
                    <circle cx="34" cy="54" r="5.5" />
                  </g>
                  <circle cx="74" cy="48" r="7" fill="#0d0b16" stroke="#2dd4bf" strokeWidth="1.4" />
                  <text x="74" y="50" fill="rgba(255,255,255,0.7)" fontSize="5" textAnchor="middle" fontFamily="JetBrains Mono, monospace">★</text>
                </svg>
                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/40 px-2.5 py-1.5 backdrop-blur">
                  <span className="text-[8px] text-teal-200/80">Shortest path · 0 → 4</span>
                  <span className="font-mono text-[8px] text-white/30">18:42</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary-300/20 bg-gradient-to-br from-primary-500/30 to-teal2/[0.06]">
                  <Sparkles className="h-4 w-4 text-primary-100" />
                </span>
                <div>
                  <h2 className="font-display text-[16px] font-semibold tracking-[-0.015em] text-white">Vertexon AI Insights</h2>
                  <p className="mt-0.5 text-[10.5px] text-white/30">Personalized from your latest quiz and lecture activity</p>
                </div>
              </div>
              <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[9px] font-medium text-white/40">
                {recommendation ? `Recommendation · ${recommendation.score}% match` : 'Personalized learning'}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary-400/15 bg-gradient-to-r from-primary-500/[0.1] to-teal2/[0.025] p-3.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-primary-400/15 bg-primary-500/10">
                  <Crosshair className="h-3.5 w-3.5 text-primary-200" />
                </span>
                <p className="text-[11.5px] leading-[1.7] text-white/45">
                  <span className="font-semibold text-primary-200">Next best step:</span>{' '}
                  {recommendation
                    ? `${recommendation.reason} Explore “${recommendation.title}”.`
                    : 'Continue your current course or ask the AI tutor to build a focused study plan.'}
                </p>
              </div>
              <button
                onClick={() => navigate(recommendation ? '/learn' : '/tutor')}
                className="shrink-0 rounded-lg border border-primary-400/20 bg-primary-500/10 px-3 py-2 text-[10.5px] font-medium text-primary-200 transition hover:bg-primary-500/15"
              >
                {recommendation ? 'View course' : 'Open AI tutor'}
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {insights.map((insight) => {
                const Icon = insight.icon;
                return (
                  <button
                    key={insight.title}
                    onClick={() => {
                      if (insight.action === 'tutor') navigate('/tutor');
                      else if (insight.action === 'quiz') navigate('/quiz');
                      else showToast('5 flashcards generated · added to your revision deck.');
                    }}
                    className="group rounded-xl border border-white/[0.06] bg-white/[0.018] p-4 text-left transition hover:-translate-y-0.5 hover:border-primary-400/25 hover:bg-white/[0.035]"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`grid h-8 w-8 place-items-center rounded-lg border ${insight.tone}`}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-white/15 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/40" />
                    </div>
                    <p className="mt-3 text-[12px] font-semibold text-white/75 transition group-hover:text-white">
                      {insight.title}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-[1.6] text-white/30">{insight.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[16px] font-semibold tracking-[-0.015em] text-white">Your courses</h2>
                <p className="mt-0.5 text-[10.5px] text-white/30">Pick up where you left off</p>
              </div>
              <button onClick={() => navigate('/learn')} className="flex items-center gap-1 text-[10.5px] font-medium text-primary-300 transition hover:text-primary-200">
                Browse all <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {courses.map((course) => {
                const theme = themeFor(course.course_id);
                const instructor = instructors[course.course_id] || 'Vertexon instructor';
                const completedLessons = Math.round((course.lessons_count * course.progress) / 100);
                return (
                  <button
                    key={course.id}
                    onClick={() => {
                      if (course.progress >= 100) {
                        navigate('/achievements');
                        showToast(`${course.title} · certificate ready.`);
                      } else {
                        navigate(`/lesson?course=${course.course_id}`);
                      }
                    }}
                    className={`group overflow-hidden rounded-2xl border bg-[#100d19] text-left transition hover:-translate-y-0.5 hover:brightness-110 ${theme.border}`}
                  >
                    <div className={`relative h-[94px] overflow-hidden bg-gradient-to-br p-3 ${theme.tone}`}>
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
                          backgroundSize: '16px 16px',
                        }}
                      />
                      <span className="relative rounded bg-black/25 px-1.5 py-[3px] text-[7.5px] font-bold uppercase tracking-[0.1em] text-white/50 backdrop-blur">
                        {course.category}
                      </span>
                      <span className={`pointer-events-none absolute -bottom-2 right-2 font-mono text-[38px] font-bold leading-none ${theme.glyphClass}`}>
                        {course.glyph}
                      </span>
                      {course.progress >= 100 && (
                        <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-[3px] text-[7px] font-semibold text-emerald-300">
                          <Trophy className="h-2.5 w-2.5" /> Certificate
                        </span>
                      )}
                    </div>

                    <div className="p-3.5">
                      <p className="line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-[1.45] text-white/80 transition group-hover:text-white">
                        {course.title}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Avatar name={instructor} size={18} />
                        <span className="text-[9.5px] text-white/30">{instructor}</span>
                        <span className="ml-auto font-mono text-[9px] text-primary-300/60">{course.progress}%</span>
                      </div>
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal2 to-primary-400"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9px] text-white/25">
                        <span>{completedLessons} of {course.lessons_count} lessons</span>
                        <span className="truncate pl-2 text-white/20">
                          {course.progress >= 100 ? 'Certificate earned' : course.difficulty}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            onClick={() => showToast('Announcement · Midterm deadline extended to Friday, 11:59 PM.')}
            className="flex w-full items-start gap-3 rounded-2xl border border-white/[0.06] bg-[#100d18] p-4 text-left transition hover:border-white/[0.1] hover:bg-[#141020]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary-300/15 bg-gradient-to-br from-primary-500/20 to-teal2/[0.04]">
              <Megaphone className="h-4 w-4 text-primary-200" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-white/80">DSA Cohort Announcement</span>
                <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-1.5 py-[2px] text-[8px] text-white/25">35m ago</span>
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-white/35">
                Rohit Verma: The midterm submission deadline has been extended to Friday, 11:59 PM. Office hours move to
                Thursday 7 PM.
              </span>
            </span>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/20" />
          </button>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[14px] font-semibold text-white/90">Study activity</h2>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[8.5px] text-white/30">This week</span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <p className="font-display text-[25px] font-bold leading-none tracking-[-0.03em] text-white">{data?.stats.hours_learned || 0}h</p>
              <span className="mb-0.5 flex items-center gap-0.5 text-[9px] font-medium text-emerald-300">
                <TrendingUp className="h-2.5 w-2.5" /> {currentStreak}d
              </span>
            </div>
            <p className="mt-1 text-[9.5px] text-white/25">Across {courses.length} enrolled courses</p>

            <div className="mt-4 flex h-[102px] items-end gap-2">
              {activity.map((item) => (
                <div key={item.day} className="group flex flex-1 flex-col items-center gap-1.5">
                  <div className="relative flex h-[78px] w-full items-end justify-center">
                    <div
                      className={`w-full rounded-md transition group-hover:brightness-125 ${
                        item.today
                          ? 'bg-gradient-to-t from-primary-500/80 to-teal2/80 shadow-[0_0_18px_rgba(139,92,246,0.35)]'
                          : 'bg-gradient-to-t from-primary-500/25 to-primary-300/35'
                      }`}
                      style={{ height: `${item.value}%` }}
                    />
                    <span className="absolute -top-4 text-[7px] font-medium text-white/0 transition group-hover:text-white/50">{item.minutes}m</span>
                  </div>
                  <span className={`text-[8px] font-medium ${item.today ? 'text-primary-200' : 'text-white/25'}`}>{item.day}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.055] border-t border-white/[0.055] pt-3">
              {[
                [`${dailyMinutes} min`, 'Today'],
                [`${currentStreak} days`, 'Streak'],
                [`${dailyPercent}%`, 'Daily goal'],
              ].map(([value, label]) => (
                <div key={label} className="px-3 first:pl-0 last:pr-0">
                  <p className="font-display text-[12.5px] font-semibold text-white/80">{value}</p>
                  <p className="mt-0.5 text-[8.5px] text-white/25">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[14px] font-semibold text-white/90">Today&apos;s plan</h2>
              <span className="text-[9px] text-white/25">{livePlan.filter((item) => item.state === 'done').length} of {livePlan.length} done</span>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal2 to-primary-400"
                style={{ width: `${(livePlan.filter((item) => item.state === 'done').length / livePlan.length) * 100}%` }}
              />
            </div>

            <div className="mt-3 space-y-1.5">
              {livePlan.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition ${
                    item.state === 'current'
                      ? 'border-primary-400/20 bg-primary-500/[0.06] hover:bg-primary-500/[0.1]'
                      : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.02]'
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                      item.state === 'done'
                        ? 'border-teal2/25 bg-teal2/15 text-teal-300'
                        : item.state === 'current'
                          ? 'border-primary-400/25 bg-primary-500/15 text-primary-200'
                          : 'border-white/[0.1] text-white/20'
                    }`}
                  >
                    {item.state === 'done' ? <Check className="h-3 w-3" /> : item.state === 'current' ? <Play className="h-2.5 w-2.5 fill-current" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[10.5px] font-medium ${item.state === 'done' ? 'text-white/40 line-through' : 'text-white/70'}`}>
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[8.5px] text-white/25">{item.detail}</span>
                  </span>
                  <span className="shrink-0 text-[8px] text-white/25">{item.meta}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[14px] font-semibold text-white/90">Study circle</h2>
                <p className="mt-0.5 text-[8.5px] text-white/25">Your four-person accountability group</p>
              </div>
              <Trophy className="h-3.5 w-3.5 text-amber-300/60" />
            </div>
            <div className="mt-3 space-y-1">
              {(data?.leaderboard || []).slice(0, 4).map((leader, index) => {
                const isYou = leader.id === data?.user.id;
                return (
                  <div
                    key={leader.id}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-2 transition ${
                      isYou ? 'border border-primary-400/15 bg-primary-500/[0.07]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <span className={`w-4 text-center font-mono text-[9px] font-semibold ${isYou ? 'text-primary-300' : index === 0 ? 'text-amber-300' : 'text-white/25'}`}>
                      {index + 1}
                    </span>
                    <Avatar name={leader.full_name} size={23} online={isYou} />
                    <span className={`min-w-0 flex-1 truncate text-[10.5px] ${isYou ? 'font-medium text-white/70' : 'text-white/55'}`}>
                      {isYou ? `${leader.full_name.split(' ')[0]} · You` : leader.full_name}
                    </span>
                    <span className={`font-mono text-[8.5px] ${isYou ? 'text-primary-200/70' : 'text-white/30'}`}>{leader.current_streak}d streak</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => showToast(`Study circle · you are #${Math.max(1, (data?.leaderboard || []).findIndex((row) => row.id === data?.user.id) + 1)} of ${data?.leaderboard.length || 0} learners.`)}
              className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 text-[9px] font-medium text-white/40 transition hover:text-white/70"
            >
              View cohort leaderboard <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </section>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
            <Users className="h-3.5 w-3.5 shrink-0 text-white/20" />
            <p className="text-[9px] leading-snug text-white/25">
              You&apos;re learning alongside your <span className="text-white/45">Vertexon study circle</span> this week.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
