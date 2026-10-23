import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, apiPost, apiPut, errorMessage } from '../lib/api';

type PendingCourse = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  instructor_name: string;
  module_count: number;
  created_at: string;
};

type FlaggedPost = {
  id: string;
  author_name: string;
  thread_title: string;
  course_title: string;
  content: string;
  created_at: string;
};

type RecentUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

type AuditLog = {
  id: string;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string;
  created_at: string;
};

type Overview = {
  stats: {
    total_users: number;
    active_students: number;
    instructors: number;
    suspended_users: number;
    total_courses: number;
    approved_courses: number;
    pending_courses: number;
    enrollments: number;
    completion_rate: number;
    revenue: number;
    flagged_posts: number;
    active_today: number;
    quiz_attempts: number;
  };
  pending_courses: PendingCourse[];
  recent_users: RecentUser[];
  flagged_posts: FlaggedPost[];
  audit_logs: AuditLog[];
};

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const dateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setError('');
    try {
      setData(await api<Overview>('/admin/overview'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const firstName = useMemo(() => (user?.full_name || 'Admin').split(' ')[0], [user?.full_name]);

  const decideCourse = async (course: PendingCourse, decision: 'approved' | 'rejected') => {
    setBusy(`course-${course.id}`);
    try {
      await apiPost(`/courses/${course.id}/approve`, { decision, comment: 'Reviewed from admin console.' });
      setData((current) =>
        current
          ? {
              ...current,
              pending_courses: current.pending_courses.filter((item) => item.id !== course.id),
              stats: { ...current.stats, pending_courses: Math.max(0, current.stats.pending_courses - 1), approved_courses: decision === 'approved' ? current.stats.approved_courses + 1 : current.stats.approved_courses },
            }
          : current,
      );
      showToast(`${course.title} · ${decision}.`);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const moderate = async (post: FlaggedPost, action: 'dismiss' | 'remove') => {
    setBusy(`post-${post.id}`);
    try {
      await apiPut(`/admin/moderation/posts/${post.id}`, { action });
      setData((current) =>
        current
          ? {
              ...current,
              flagged_posts: current.flagged_posts.filter((item) => item.id !== post.id),
              stats: { ...current.stats, flagged_posts: Math.max(0, current.stats.flagged_posts - 1) },
            }
          : current,
      );
      showToast(action === 'remove' ? 'Post removed from the forum.' : 'Report dismissed.');
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <AdminSkeleton />;
  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-8 text-center">
          <p className="text-[13px] font-semibold text-rose-200">Could not open the admin console.</p>
          <p className="mt-1 text-[11px] text-white/35">{error}</p>
          <button onClick={() => { setLoading(true); load(); }} className="btn-ghost mt-4 h-9 px-4 text-[11px]"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-300/75">
            <ShieldCheck className="h-3.5 w-3.5" /> Platform administration
          </div>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Platform health, {firstName}.
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/35">
            Course approvals, role management, moderation, and growth signals across Vertexon.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('/admin/courses')} className="btn-ghost h-10 px-4 text-[11.5px]"><BookOpen className="h-3.5 w-3.5" /> Course approvals</button>
          <button onClick={() => navigate('/admin/users')} className="btn-primary h-10 px-4 text-[11.5px]"><UserCog className="h-3.5 w-3.5" /> Manage users</button>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Metric icon={Users} label="Total users" value={data.stats.total_users.toLocaleString()} detail={`${data.stats.active_students} students`} />
        <Metric icon={BookOpen} label="Published courses" value={`${data.stats.approved_courses}`} detail={`${data.stats.pending_courses} pending`} />
        <Metric icon={Users} label="Enrollments" value={data.stats.enrollments.toLocaleString()} detail={`${data.stats.active_today} active today`} />
        <Metric icon={CheckCircle2} label="Avg. completion" value={`${data.stats.completion_rate}%`} detail={`${data.stats.quiz_attempts} quiz ${data.stats.quiz_attempts === 1 ? 'attempt' : 'attempts'}`} />
        <Metric icon={Wallet} label="Revenue" value={inr(data.stats.revenue)} detail="Successful payments" />
        <Metric icon={ShieldAlert} label="Moderation" value={`${data.stats.flagged_posts}`} detail={`${data.stats.suspended_users} suspended users`} danger={data.stats.flagged_posts > 0} />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
            <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-4">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-white/90">Approval queue</h2>
                <p className="mt-0.5 text-[9.5px] text-white/27">Courses waiting for a publishing decision</p>
              </div>
              <button onClick={() => navigate('/admin/courses')} className="flex items-center gap-1 text-[10px] font-medium text-primary-300 hover:text-primary-200">All courses <ArrowRight className="h-3 w-3" /></button>
            </div>
            <div className="divide-y divide-white/[0.045]">
              {data.pending_courses.map((course) => (
                <div key={course.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[11.5px] font-semibold text-white/75">{course.title}</p>
                      <span className="rounded border border-amber-400/15 bg-amber-400/[0.07] px-1.5 py-[1px] text-[7px] font-bold uppercase text-amber-300">pending</span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[8.5px] text-white/25">
                      <span>{course.instructor_name}</span><span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span>{course.category}</span><span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span>{course.module_count} modules</span><span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span>Submitted {dateLabel(course.created_at)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button onClick={() => decideCourse(course, 'rejected')} disabled={busy === `course-${course.id}`} className="flex items-center gap-1 rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-2.5 py-2 text-[8.5px] font-medium text-rose-200 transition hover:bg-rose-400/[0.12] disabled:opacity-50">
                      <XCircle className="h-3 w-3" /> Reject
                    </button>
                    <button onClick={() => decideCourse(course, 'approved')} disabled={busy === `course-${course.id}`} className="btn-primary h-8 px-3 text-[8.5px] disabled:opacity-50">
                      {busy === `course-${course.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Approve
                    </button>
                  </div>
                </div>
              ))}
              {data.pending_courses.length === 0 && (
                <div className="px-5 py-10 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-emerald-300/40" /><p className="mt-2 text-[11px] text-white/45">Approval queue is clear.</p><p className="mt-1 text-[9px] text-white/22">New submissions will appear here.</p></div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-white/90">Platform activity</h2>
                <p className="mt-0.5 text-[9.5px] text-white/27">Audit events across roles and content</p>
              </div>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[8px] text-white/30">Audit log</span>
            </div>
            <div className="mt-3 space-y-1">
              {data.audit_logs.slice(0, 7).map((log) => (
                <div key={log.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-white/[0.018]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/[0.06] bg-white/[0.02]"><Clock className="h-2.5 w-2.5 text-white/25" /></span>
                  <p className="min-w-0 flex-1 truncate text-[9.5px] text-white/40"><span className="font-medium text-white/60">{log.actor_name || 'System'}</span> · {log.action.replace(/[._]/g, ' ')} <span className="text-white/22">{log.entity}</span></p>
                  <span className="shrink-0 font-mono text-[8px] text-white/20">{dateLabel(log.created_at)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-rose-400/15 bg-[#160f18] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/15 bg-rose-400/[0.08]"><Flag className="h-3.5 w-3.5 text-rose-300" /></span><div><h2 className="text-[12px] font-semibold text-white/85">Moderation queue</h2><p className="text-[8px] text-white/25">{data.flagged_posts.length} reported posts</p></div></div>
              <button onClick={() => navigate('/admin/moderation')} className="text-white/25 transition hover:text-white/60"><ArrowUpRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-3 space-y-2">
              {data.flagged_posts.slice(0, 3).map((post) => (
                <div key={post.id} className="rounded-xl border border-white/[0.055] bg-black/15 p-3">
                  <p className="text-[9px] font-medium text-white/55">{post.author_name} · {post.thread_title}</p>
                  <p className="mt-1 line-clamp-2 text-[8.5px] leading-relaxed text-white/28">{post.content}</p>
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => moderate(post, 'dismiss')} disabled={busy === `post-${post.id}`} className="flex-1 rounded border border-white/[0.07] py-1.5 text-[8px] text-white/40 transition hover:text-white/70 disabled:opacity-50">Dismiss</button>
                    <button onClick={() => moderate(post, 'remove')} disabled={busy === `post-${post.id}`} className="flex-1 rounded border border-rose-400/15 bg-rose-400/[0.06] py-1.5 text-[8px] text-rose-200 transition hover:bg-rose-400/[0.12] disabled:opacity-50">Remove</button>
                  </div>
                </div>
              ))}
              {data.flagged_posts.length === 0 && <p className="py-4 text-center text-[9.5px] text-emerald-300/45">No flagged content.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Newest users</h2>
              <button onClick={() => navigate('/admin/users')} className="text-white/25 transition hover:text-white/60"><ArrowUpRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {data.recent_users.slice(0, 5).map((person) => (
                <div key={person.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                  <Avatar name={person.full_name} size={24} />
                  <div className="min-w-0 flex-1"><p className="truncate text-[9.5px] font-medium text-white/60">{person.full_name}</p><p className="truncate text-[8px] text-white/22">{person.email}</p></div>
                  <span className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[7px] uppercase tracking-wide text-white/28">{person.role}</span>
                </div>
              ))}
            </div>
          </section>

          <button onClick={() => navigate('/admin/moderation')} className="flex w-full items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3 text-left transition hover:border-white/[0.1]">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-300/50" />
            <span className="text-[8.5px] leading-relaxed text-white/25">Review the flagged-content queue before it becomes a learner trust problem. Dismiss removes the flag; remove deletes the post.</span>
          </button>
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, danger }: { icon: typeof Users; label: string; value: string; detail: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${danger ? 'border-rose-400/15 bg-[#160f18]' : 'border-white/[0.06] bg-[#100d19]'}`}>
      <span className={`grid h-8 w-8 place-items-center rounded-lg border ${danger ? 'border-rose-400/15 bg-rose-400/[0.07] text-rose-300' : 'border-white/[0.06] bg-white/[0.025] text-primary-300'}`}><Icon className="h-3.5 w-3.5" /></span>
      <p className="mt-3 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">{label}</p>
      <p className="mt-1 font-display text-[20px] font-bold leading-none tracking-[-0.03em] text-white">{value}</p>
      <p className="mt-1.5 text-[8.5px] text-white/25">{detail}</p>
    </div>
  );
}

function AdminSkeleton() {
  return <div className="mx-auto w-full max-w-[1440px] animate-pulse px-4 py-6 sm:px-6 lg:px-8"><div className="h-8 w-72 rounded-lg bg-white/[0.05]" /><div className="mt-2 h-4 w-96 max-w-full rounded bg-white/[0.035]" /><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[112px] rounded-2xl border border-white/[0.05] bg-white/[0.02]" />)}</div><div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]"><div className="h-[460px] rounded-2xl border border-white/[0.05] bg-white/[0.02]" /><div className="h-[460px] rounded-2xl border border-white/[0.05] bg-white/[0.02]" /></div></div>;
}
