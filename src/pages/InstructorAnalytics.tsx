import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  Clock,
  GraduationCap,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import { api, errorMessage } from '../lib/api';

type LectureAnalytics = {
  id: string;
  title: string;
  duration_seconds: number;
  viewers: number;
  completions: number;
  avg_watched: number;
  drop_off: number;
};

type CourseAnalytics = {
  course: { id: string; title: string; status: string; price: number; rating: number };
  stats: {
    learners: number;
    avg_progress: number;
    quiz_average: number;
    revenue: number;
    pending_submissions: number;
  };
  lectures: LectureAnalytics[];
};

type Student = {
  id: string;
  full_name: string;
  email: string;
  headline?: string;
  course_count: number;
  avg_progress: number;
  last_enrolled: string;
  submission_count: number;
};

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

export default function InstructorAnalytics() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [analytics, setAnalytics] = useState<CourseAnalytics[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [analyticsData, studentData] = await Promise.all([
        api<{ analytics: CourseAnalytics[] }>('/instructor/analytics'),
        api<{ students: Student[] }>('/instructor/students'),
      ]);
      setAnalytics(analyticsData.analytics);
      setStudents(studentData.students);
      setSelected((current) => current || analyticsData.analytics[0]?.course.id || null);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const active = useMemo(
    () => analytics.find((item) => item.course.id === selected) || analytics[0] || null,
    [analytics, selected],
  );

  const totals = useMemo(
    () => ({
      learners: analytics.reduce((sum, item) => sum + item.stats.learners, 0),
      completion: analytics.length
        ? Math.round(analytics.reduce((sum, item) => sum + item.stats.avg_progress, 0) / analytics.length)
        : 0,
      quiz: analytics.length
        ? Math.round(analytics.reduce((sum, item) => sum + item.stats.quiz_average, 0) / analytics.length)
        : 0,
      revenue: analytics.reduce((sum, item) => sum + item.stats.revenue, 0),
    }),
    [analytics],
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] animate-pulse px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-8 w-64 rounded-lg bg-white/[0.05]" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-white/[0.035]" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[120px] rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="h-[460px] rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
          <div className="h-[460px] rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <button
            onClick={() => navigate('/instructor')}
            className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-white/30 transition hover:text-white/65"
          >
            <ArrowLeft className="h-3 w-3" /> Instructor overview
          </button>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300/75">Learning intelligence</p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Analytics that teach.
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-white/35">
            See where learners finish, where they drop off, and which assessments need another explanation.
          </p>
        </div>
        <button onClick={load} className="btn-ghost h-10 px-3 text-[10px]">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh data
        </button>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticStat icon={Users} label="Total learners" value={totals.learners.toLocaleString()} detail={`${analytics.length} active courses`} tone="text-teal-300" />
        <AnalyticStat icon={TrendingUp} label="Avg. completion" value={`${totals.completion}%`} detail="Across your portfolio" tone="text-primary-300" />
        <AnalyticStat icon={BarChart3} label="Quiz average" value={`${totals.quiz}%`} detail="Graded attempts only" tone="text-amber-300" />
        <AnalyticStat icon={Wallet} label="Revenue" value={inr(totals.revenue)} detail="Successful enrollments" tone="text-fuchsia-300" />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {analytics.map((item) => (
              <button
                key={item.course.id}
                onClick={() => setSelected(item.course.id)}
                className={`rounded-lg border px-3 py-2 text-[9.5px] font-medium transition ${
                  active?.course.id === item.course.id
                    ? 'border-primary-400/25 bg-primary-500/[0.13] text-primary-100'
                    : 'border-white/[0.06] bg-white/[0.015] text-white/35 hover:text-white/65'
                }`}
              >
                {item.course.title}
              </button>
            ))}
          </div>

          {active ? (
            <>
              <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-[17px] font-semibold text-white/90">{active.course.title}</h2>
                      <span className={`rounded border px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wide ${active.course.status === 'approved' ? 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300' : 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300'}`}>
                        {active.course.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] text-white/25">Lecture-level engagement and completion signals</p>
                  </div>
                  <button onClick={() => navigate('/instructor/courses')} className="flex items-center gap-1 text-[9px] text-primary-300/70 transition hover:text-primary-200">
                    Edit curriculum <ArrowUpRight className="h-2.5 w-2.5" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MiniStat label="Learners" value={`${active.stats.learners}`} />
                  <MiniStat label="Completion" value={`${active.stats.avg_progress}%`} tone="text-teal-200" />
                  <MiniStat label="Quiz avg." value={`${active.stats.quiz_average}%`} tone="text-amber-200" />
                  <MiniStat label="Needs grading" value={`${active.stats.pending_submissions}`} tone="text-rose-200" />
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
                <div className="flex items-center justify-between border-b border-white/[0.055] px-4 py-4 sm:px-5">
                  <div>
                    <h2 className="font-display text-[14px] font-semibold text-white/90">Lecture engagement</h2>
                    <p className="mt-0.5 text-[9px] text-white/25">Completion and drop-off by lesson</p>
                  </div>
                  <span className="flex items-center gap-1 text-[8px] text-white/22"><Clock className="h-2.5 w-2.5" /> live from progress events</span>
                </div>
                <div className="divide-y divide-white/[0.045]">
                  {active.lectures.map((lecture, index) => (
                    <div key={lecture.id} className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded bg-white/[0.035] font-mono text-[8px] text-white/30">{index + 1}</span>
                        <p className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-white/62">{lecture.title}</p>
                        <span className="font-mono text-[8.5px] text-white/25">{Math.round(lecture.duration_seconds / 60)} min</span>
                        <span className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[7.5px] font-semibold ${lecture.drop_off > 50 ? 'border-rose-400/15 bg-rose-400/[0.06] text-rose-300' : 'border-teal2/15 bg-teal2/[0.05] text-teal-300'}`}>
                          {lecture.drop_off > 50 ? <TrendingDown className="h-2 w-2" /> : <TrendingUp className="h-2 w-2" />}
                          {lecture.drop_off}% drop
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-teal2"
                            style={{ width: `${Math.min(100, Math.max(3, 100 - lecture.drop_off))}%` }}
                          />
                        </div>
                        <div className="flex shrink-0 gap-3 font-mono text-[8px] text-white/25">
                          <span>{lecture.viewers} viewers</span>
                          <span>{lecture.completions} finished</span>
                          <span className="hidden sm:inline">{Math.round(lecture.avg_watched / 60)}m avg</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {active.lectures.length === 0 && <p className="px-5 py-10 text-center text-[10px] text-white/25">Add lectures to see engagement.</p>}
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.01] py-20 text-center">
              <BarChart3 className="mx-auto h-7 w-7 text-white/20" />
              <p className="mt-3 text-[12px] text-white/45">No course analytics yet.</p>
              <button onClick={() => navigate('/instructor/courses')} className="btn-primary mt-4 h-9 px-4 text-[10px]">Create a course</button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
            <div className="flex items-center justify-between border-b border-white/[0.055] px-4 py-4">
              <div>
                <h2 className="font-display text-[13px] font-semibold text-white/90">Your learners</h2>
                <p className="mt-0.5 text-[8.5px] text-white/25">Ranked by average progress</p>
              </div>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[8px] text-white/30">{students.length}</span>
            </div>
            <div className="max-h-[520px] divide-y divide-white/[0.045] overflow-y-auto">
              {students.map((student, index) => (
                <div key={student.id} className="flex items-center gap-2.5 px-4 py-3">
                  <span className="w-4 shrink-0 font-mono text-[8px] text-white/20">{String(index + 1).padStart(2, '0')}</span>
                  <Avatar name={student.full_name} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium text-white/62">{student.full_name}</p>
                    <p className="truncate text-[8px] text-white/22">{student.course_count} course{student.course_count === 1 ? '' : 's'} · {student.submission_count} submissions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[9.5px] text-teal-200/70">{student.avg_progress}%</p>
                    <p className="text-[7px] text-white/20">avg progress</p>
                  </div>
                </div>
              ))}
              {students.length === 0 && <p className="px-4 py-10 text-center text-[10px] text-white/25">Learners appear once they enroll.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-primary-400/15 bg-gradient-to-br from-[#1b1331] to-[#100d19] p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-primary-400/20 bg-primary-500/15"><GraduationCap className="h-3.5 w-3.5 text-primary-200" /></span>
              <h2 className="text-[12px] font-semibold text-white/85">Teaching signal</h2>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-white/28">
              {active && active.lectures.length > 0
                ? `“${active.lectures.reduce((worst, lecture) => (lecture.drop_off > worst.drop_off ? lecture : worst), active.lectures[0]).title}” has the highest drop-off in this course. Add a recap or a short knowledge check before the next lesson.`
                : 'Add lectures and transcript content to unlock teaching recommendations.'}
            </p>
            <button onClick={() => navigate('/instructor/courses')} className="mt-3 flex items-center gap-1 text-[8.5px] font-medium text-primary-300 transition hover:text-primary-200">
              Open curriculum builder <ArrowUpRight className="h-2.5 w-2.5" />
            </button>
          </section>

          <div className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
            <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/20" />
            <p className="text-[8.5px] leading-relaxed text-white/25">Completion uses actual lecture-progress records. A learner counts as a viewer when they have watched any part of a lecture.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AnalyticStat({ icon: Icon, label, value, detail, tone }: { icon: typeof Users; label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#100d19] p-4">
      <span className={`grid h-9 w-9 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.025] ${tone}`}><Icon className="h-4 w-4" /></span>
      <p className="mt-3 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/25">{label}</p>
      <p className="mt-1 font-display text-[22px] font-bold leading-none tracking-[-0.03em] text-white">{value}</p>
      <p className="mt-1.5 text-[8.5px] text-white/25">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value, tone = 'text-white/70' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
      <p className="text-[7.5px] uppercase tracking-[0.1em] text-white/22">{label}</p>
      <p className={`mt-1 font-mono text-[13px] font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
