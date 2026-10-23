import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { api, apiPost, errorMessage } from '../lib/api';

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  status: 'approved' | 'pending' | 'rejected';
  rating: number;
  price: number;
  instructor_name: string;
  learner_count: number;
  module_count: number;
  glyph: string;
  tone: string;
  created_at: string;
};

const tabs = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All courses' },
] as const;

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const dateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function AdminCourses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]['value']>('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ courses: Course[] }>('/admin/courses');
      setCourses(data.courses);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(
    () => ({
      pending: courses.filter((course) => course.status === 'pending').length,
      approved: courses.filter((course) => course.status === 'approved').length,
      rejected: courses.filter((course) => course.status === 'rejected').length,
      all: courses.length,
    }),
    [courses],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter((course) => {
      if (tab !== 'all' && course.status !== tab) return false;
      if (!needle) return true;
      return (
        course.title.toLowerCase().includes(needle) ||
        course.instructor_name.toLowerCase().includes(needle) ||
        course.category.toLowerCase().includes(needle)
      );
    });
  }, [courses, tab, query]);

  const decide = async (course: Course, decision: 'approved' | 'rejected') => {
    setBusy(course.id);
    try {
      await apiPost(`/courses/${course.id}/approve`, {
        decision,
        comment: 'Reviewed in the admin course directory.',
      });
      setCourses((current) => current.map((item) => (item.id === course.id ? { ...item, status: decision } : item)));
      showToast(`${course.title} · ${decision}.`);
      if (tab === 'pending') setExpanded(null);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <button
            onClick={() => navigate('/admin')}
            className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-white/30 transition hover:text-white/65"
          >
            <ArrowLeft className="h-3 w-3" /> Admin overview
          </button>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-300/75">Content governance</p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Course directory.
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-white/35">
            Review new submissions, inspect curriculum depth, and keep the public catalog trustworthy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <div>
            <p className="text-[8px] uppercase tracking-[0.12em] text-white/25">Pending</p>
            <p className="mt-0.5 font-display text-[16px] font-semibold text-amber-300">{counts.pending}</p>
          </div>
          <span className="h-7 w-px bg-white/[0.07]" />
          <div>
            <p className="text-[8px] uppercase tracking-[0.12em] text-white/25">Published</p>
            <p className="mt-0.5 font-display text-[16px] font-semibold text-emerald-300">{counts.approved}</p>
          </div>
          <span className="h-7 w-px bg-white/[0.07]" />
          <div>
            <p className="text-[8px] uppercase tracking-[0.12em] text-white/25">Rejected</p>
            <p className="mt-0.5 font-display text-[16px] font-semibold text-rose-300">{counts.rejected}</p>
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          {tabs.map((item) => (
            <button
              key={item.value}
              onClick={() => setTab(item.value)}
              className={`rounded-lg px-3 py-2 text-[10px] font-medium transition ${
                tab === item.value ? 'bg-primary-500/[0.18] text-primary-100' : 'text-white/35 hover:text-white/65'
              }`}
            >
              {item.label}
              <span className="ml-1.5 font-mono text-[8px] text-white/25">{counts[item.value]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-[#100d19] px-3.5 lg:w-72">
            <Search className="h-4 w-4 shrink-0 text-white/25" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search course or instructor..."
              className="h-full min-w-0 flex-1 bg-transparent text-[11.5px] text-white/75 placeholder:text-white/20 focus:outline-none"
              aria-label="Search courses"
            />
          </div>
          <button onClick={load} className="btn-ghost h-10 px-3 text-[10px]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {loading && courses.length === 0 &&
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-[112px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
          ))}
        {!loading && visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.01] py-16 text-center">
            <BookOpen className="mx-auto h-6 w-6 text-white/20" />
            <p className="mt-2 text-[11px] text-white/40">No courses in this view.</p>
            <p className="mt-1 text-[9px] text-white/22">Try another tab or clear the search.</p>
          </div>
        )}
        {visible.map((course) => {
          const open = expanded === course.id;
          return (
            <article key={course.id} className="overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${
                    course.tone || 'from-[#25184b] to-[#121021]'
                  } font-mono text-[13px] font-bold text-white/60`}
                >
                  {course.glyph || 'VC'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button onClick={() => setExpanded(open ? null : course.id)} className="text-left text-[12.5px] font-semibold text-white/80 transition hover:text-white">
                      {course.title}
                    </button>
                    <Status status={course.status} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[8.5px] text-white/25">
                    <span>{course.instructor_name}</span>
                    <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                    <span>{course.category}</span>
                    <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                    <span>{course.difficulty}</span>
                    <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                    <span>{course.module_count} modules</span>
                    <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                    <span>Submitted {dateLabel(course.created_at)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="hidden text-right md:block">
                    <p className="text-[8px] text-white/25">Learners</p>
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-white/55">
                      <Users className="h-2.5 w-2.5 text-white/20" /> {course.learner_count}
                    </p>
                  </div>
                  <div className="hidden text-right md:block">
                    <p className="text-[8px] text-white/25">Price</p>
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-teal-200/65">
                      <Wallet className="h-2.5 w-2.5 text-teal-300/35" /> {inr(course.price)}
                    </p>
                  </div>
                  <button onClick={() => setExpanded(open ? null : course.id)} className="btn-ghost h-8 px-2 text-[9px]">
                    Details <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {course.status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => decide(course, 'rejected')}
                        disabled={busy === course.id}
                        className="flex items-center gap-1 rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-2.5 py-2 text-[8.5px] font-medium text-rose-200 transition hover:bg-rose-400/[0.12] disabled:opacity-50"
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                      <button
                        onClick={() => decide(course, 'approved')}
                        disabled={busy === course.id}
                        className="btn-primary h-8 px-3 text-[8.5px] disabled:opacity-50"
                      >
                        {busy === course.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {open && (
                <div className="border-t border-white/[0.055] bg-[#0c0a13] px-4 py-4 sm:px-5">
                  <p className="max-w-3xl text-[10.5px] leading-relaxed text-white/38">
                    {course.description || 'No description provided by the instructor yet.'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[8.5px] text-white/25">
                    <span className="flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" /> {course.module_count} modules</span>
                    <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" /> {course.learner_count} enrolled</span>
                    <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Created {dateLabel(course.created_at)}</span>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Status({ status }: { status: Course['status'] }) {
  const styles =
    status === 'approved'
      ? 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300'
      : status === 'rejected'
        ? 'border-rose-400/15 bg-rose-400/[0.07] text-rose-300'
        : 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300';
  return <span className={`rounded border px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wide ${styles}`}>{status}</span>;
}
