import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, apiPost, errorMessage } from '../lib/api';

type CourseRow = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  status: string;
  rating: number;
  price: number;
  glyph?: string;
  tone?: string;
  tag_class?: string;
  learners: number;
  avg_progress: number;
  quiz_average: number;
  revenue: number;
  pending_submissions: number;
  modules: number;
  lectures: number;
};

type Submission = {
  id: string;
  assignment_title: string;
  course_title: string;
  student_name: string;
  submitted_at: string;
  file_name: string;
  status: string;
};

type Draft = {
  id: string;
  title: string;
  course_title: string;
  question_count: number;
  created_at: string;
};

type Overview = {
  stats: {
    total_courses: number;
    published_courses: number;
    pending_courses: number;
    learners: number;
    avg_completion: number;
    revenue: number;
    pending_submissions: number;
  };
  courses: CourseRow[];
  pending_submissions: Submission[];
  drafts: Draft[];
  recent_enrollments: Array<{ enrolled_at: string; student_name: string; course_title: string }>;
};

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const dateLabel = (value: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);

  const load = async () => {
    setError('');
    try {
      const response = await api<Overview>('/instructor/overview');
      setData(response);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const firstName = useMemo(() => (user?.full_name || 'Instructor').split(' ')[0], [user?.full_name]);

  const publishDraft = async (draft: Draft) => {
    setPublishing(draft.id);
    try {
      await apiPost(`/instructor/quizzes/${draft.id}/publish`);
      setData((current) => (current ? { ...current, drafts: current.drafts.filter((item) => item.id !== draft.id) } : current));
      showToast(`Published · ${draft.title}`);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setPublishing(null);
    }
  };

  if (loading) return <InstructorSkeleton />;
  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-8 text-center">
          <p className="text-[13px] font-semibold text-rose-200">Could not load the instructor workspace.</p>
          <p className="mt-1 text-[11px] text-white/35">{error}</p>
          <button onClick={() => { setLoading(true); load(); }} className="btn-ghost mt-4 h-9 px-4 text-[11px]">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/30">
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> Instructor studio
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
            <span className="font-medium text-teal-300/70">Teaching workspace</span>
          </div>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Good to see you, {firstName}.
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/35">
            Your courses, learner signals, and grading queue in one place. Use the data to teach the next lesson better.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('/instructor/analytics')} className="btn-ghost h-10 px-4 text-[11.5px]">
            <BarChart3 className="h-3.5 w-3.5" /> View analytics
          </button>
          <button onClick={() => navigate('/instructor/courses')} className="btn-primary h-10 px-4 text-[11.5px]">
            <Plus className="h-3.5 w-3.5" /> New course
          </button>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} label="Active learners" value={data.stats.learners.toLocaleString()} detail={`${data.stats.total_courses} courses`} tone="text-teal-300" />
        <StatCard icon={BookOpen} label="Published" value={`${data.stats.published_courses}`} detail={`${data.stats.pending_courses} awaiting review`} tone="text-primary-300" />
        <StatCard icon={TrendingUp} label="Avg. completion" value={`${data.stats.avg_completion}%`} detail="Across your courses" tone="text-amber-300" />
        <StatCard icon={Wallet} label="Course revenue" value={inr(data.stats.revenue)} detail="Paid enrollments" tone="text-fuchsia-300" />
        <button
          onClick={() => navigate('/assignments')}
          className="group rounded-2xl border border-rose-400/15 bg-[#160f18] p-4 text-left transition hover:border-rose-400/30"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-rose-400/15 bg-rose-400/[0.08]">
              <ClipboardCheck className="h-4 w-4 text-rose-300" />
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-white/15 transition group-hover:text-white/45" />
          </div>
          <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/28">Needs grading</p>
          <p className="mt-1 font-display text-[24px] font-bold leading-none text-white">{data.stats.pending_submissions}</p>
          <p className="mt-1.5 text-[9.5px] text-white/28">Open the grading queue</p>
        </button>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
            <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-4">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-white/90">Course performance</h2>
                <p className="mt-0.5 text-[9.5px] text-white/27">Completion, quiz averages, and learner counts</p>
              </div>
              <button onClick={() => navigate('/instructor/courses')} className="flex items-center gap-1 text-[10px] font-medium text-primary-300 transition hover:text-primary-200">
                Manage <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-white/[0.045]">
              {data.courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => navigate('/instructor/courses')}
                  className="group flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-white/[0.018] lg:flex-row lg:items-center"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${course.tone || 'from-[#25184b] to-[#121021]'} font-mono text-[12px] font-bold text-white/60`}>
                    {course.glyph || 'VC'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-white/78 group-hover:text-white">{course.title}</span>
                      <span className={`rounded border px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wide ${course.status === 'approved' ? 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300' : 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300'}`}>
                        {course.status}
                      </span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-white/25">
                      <span>{course.category}</span>
                      <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span>{course.learners} learners</span>
                      <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span>{course.modules} modules · {course.lectures} lectures</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="hidden w-[110px] sm:block">
                      <span className="flex items-center justify-between text-[8.5px] text-white/25">
                        <span>Completion</span><span className="text-white/50">{course.avg_progress}%</span>
                      </span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span className="block h-full rounded-full bg-gradient-to-r from-teal2 to-primary-400" style={{ width: `${course.avg_progress}%` }} />
                      </span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="block text-[8.5px] text-white/25">Quiz avg.</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-white/55">{course.quiz_average}%</span>
                    </span>
                    <span className="hidden text-right md:block">
                      <span className="block text-[8.5px] text-white/25">Revenue</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-teal-200/65">{inr(course.revenue)}</span>
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/15 transition group-hover:text-primary-200" />
                  </span>
                </button>
              ))}
              {data.courses.length === 0 && (
                <div className="px-5 py-10 text-center text-[11px] text-white/30">No courses yet. Create your first course to get started.</div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-white/90">Recent learner activity</h2>
                <p className="mt-0.5 text-[9.5px] text-white/27">Enrollment events across your courses</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-teal2/15 bg-teal2/[0.06] text-teal-300">
                <Users className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2.5 divide-y divide-white/[0.045]">
              {data.recent_enrollments.map((item, index) => (
                <div key={`${item.student_name}-${index}`} className="flex items-center gap-3 py-2.5">
                  <Avatar name={item.student_name} size={25} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] text-white/62"><span className="font-semibold text-white/78">{item.student_name}</span> enrolled in {item.course_title}</p>
                    <p className="mt-0.5 text-[8.5px] text-white/22">{dateLabel(item.enrolled_at)}</p>
                  </div>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/45" />
                </div>
              ))}
              {data.recent_enrollments.length === 0 && <p className="py-5 text-center text-[10.5px] text-white/25">No enrollments yet.</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Grading queue</h2>
              <span className="rounded-full border border-rose-400/15 bg-rose-400/[0.07] px-2 py-0.5 text-[8px] font-semibold text-rose-300">{data.pending_submissions.length} pending</span>
            </div>
            <div className="mt-3 space-y-2">
              {data.pending_submissions.slice(0, 4).map((submission) => (
                <div key={submission.id} className="rounded-xl border border-white/[0.055] bg-white/[0.015] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[10.5px] font-semibold text-white/70">{submission.student_name}</p>
                      <p className="mt-0.5 truncate text-[8.5px] text-white/28">{submission.assignment_title}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[8px] text-white/22">{dateLabel(submission.submitted_at)}</span>
                  </div>
                  <button onClick={() => navigate('/assignments')} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-primary-400/15 bg-primary-500/[0.07] py-1.5 text-[8.5px] font-medium text-primary-200 transition hover:bg-primary-500/[0.12]">
                    Review submission <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {data.pending_submissions.length === 0 && <p className="py-4 text-center text-[10px] text-white/25">Grading queue is clear.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-primary-400/15 bg-gradient-to-br from-[#1d1435] to-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-primary-400/20 bg-primary-500/15">
                  <Sparkles className="h-3.5 w-3.5 text-primary-200" />
                </span>
                <div>
                  <h2 className="text-[12px] font-semibold text-white/85">AI quiz drafts</h2>
                  <p className="text-[8px] text-white/25">Generate, review, publish</p>
                </div>
              </div>
              <FileText className="h-3.5 w-3.5 text-primary-300/45" />
            </div>
            <div className="mt-3 space-y-2">
              {data.drafts.map((draft) => (
                <div key={draft.id} className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2">
                  <p className="truncate text-[9.5px] font-medium text-white/65">{draft.title}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[8px] text-white/25">{draft.course_title} · {draft.question_count} questions</span>
                    <button
                      onClick={() => publishDraft(draft)}
                      disabled={publishing === draft.id}
                      className="shrink-0 rounded border border-teal2/20 bg-teal2/[0.08] px-1.5 py-0.5 text-[7.5px] font-semibold text-teal-200 transition hover:bg-teal2/[0.14] disabled:opacity-50"
                    >
                      {publishing === draft.id ? 'Publishing…' : 'Publish'}
                    </button>
                  </div>
                </div>
              ))}
              {data.drafts.length === 0 && <p className="py-3 text-center text-[9px] text-white/25">No AI drafts waiting.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <h2 className="font-display text-[13px] font-semibold text-white/90">Quick actions</h2>
            <div className="mt-2.5 space-y-1.5">
              <QuickAction icon={Plus} label="Create a course" onClick={() => navigate('/instructor/courses')} />
              <QuickAction icon={BarChart3} label="Open analytics" onClick={() => navigate('/instructor/analytics')} />
              <QuickAction icon={ClipboardCheck} label="Grade submissions" onClick={() => navigate('/assignments')} />
              <QuickAction icon={Layers} label="Generate AI quiz" onClick={() => navigate('/instructor/courses')} />
            </div>
          </section>

          <div className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/20" />
            <p className="text-[8.5px] leading-relaxed text-white/25">Analytics refresh whenever a learner watches, submits, or attempts a quiz. Use the grading queue to keep feedback under 48 hours.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Users; label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#100d19] p-4">
      <span className={`grid h-9 w-9 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.025] ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/28">{label}</p>
      <p className="mt-1 font-display text-[23px] font-bold leading-none tracking-[-0.03em] text-white">{value}</p>
      <p className="mt-1.5 text-[9px] text-white/25">{detail}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] text-white/42 transition hover:bg-white/[0.03] hover:text-white/70">
      <Icon className="h-3.5 w-3.5 text-white/25 group-hover:text-primary-200" />
      {label}
      <ArrowRight className="ml-auto h-2.5 w-2.5 text-white/15 group-hover:text-white/40" />
    </button>
  );
}

function InstructorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] animate-pulse px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="h-8 w-64 rounded-lg bg-white/[0.05]" />
      <div className="mt-2 h-4 w-96 max-w-full rounded bg-white/[0.035]" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[130px] rounded-2xl border border-white/[0.05] bg-white/[0.02]" />)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="h-[440px] rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
        <div className="h-[440px] rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
      </div>
    </div>
  );
}
