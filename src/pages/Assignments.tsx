import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, apiPost, apiPut, apiUpload, errorMessage } from '../lib/api';

type Assignment = {
  id: string;
  course_id: string;
  course_title: string;
  title: string;
  instructions: string;
  due_date: string | null;
  created_at: string;
  rubric?: unknown;
  submission_id?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  submitted_at?: string | null;
  grade?: number | null;
  feedback?: string | null;
  status?: string | null;
  submission_count?: number;
  needs_grading?: number;
};

type Submission = {
  id: string;
  assignment_id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  status: string;
  student_name: string;
  student_email: string;
};

type CourseOption = { id: string; title: string; status: string };

type Filter = 'all' | 'todo' | 'submitted' | 'graded';

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All work' },
  { value: 'todo', label: 'To do' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'graded', label: 'Graded' },
];

const dateLabel = (value?: string | null) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const dueTone = (value?: string | null) => {
  if (!value) return { text: 'text-white/30', label: 'No due date' };
  const due = new Date(value).getTime();
  const now = Date.now();
  const days = Math.ceil((due - now) / 86_400_000);
  if (days < 0) return { text: 'text-rose-300/70', label: `Overdue by ${Math.abs(days)}d` };
  if (days <= 2) return { text: 'text-amber-300/70', label: `Due in ${days}d` };
  return { text: 'text-white/30', label: `Due ${dateLabel(value)}` };
};

const statusStyles = (status?: string | null) => {
  if (status === 'graded') return 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300';
  if (status === 'submitted') return 'border-sky-400/15 bg-sky-400/[0.07] text-sky-300';
  return 'border-white/[0.07] bg-white/[0.025] text-white/35';
};

export default function Assignments() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [reviewing, setReviewing] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [assignmentData, courseData] = await Promise.all([
        api<{ assignments: Assignment[] }>('/assignments/me'),
        isStudent ? Promise.resolve({ courses: [] as CourseOption[] }) : api<{ courses: CourseOption[] }>('/instructor/courses'),
      ]);
      setAssignments(assignmentData.assignments);
      setCourses(courseData.courses);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isStudent]);

  const stats = useMemo(() => {
    if (isStudent) {
      return {
        todo: assignments.filter((assignment) => !assignment.submission_id).length,
        submitted: assignments.filter((assignment) => assignment.submission_id && assignment.grade === null).length,
        graded: assignments.filter((assignment) => assignment.grade !== null).length,
        average: (() => {
          const graded = assignments.filter((assignment) => assignment.grade !== null);
          if (!graded.length) return 0;
          return Math.round(graded.reduce((sum, assignment) => sum + Number(assignment.grade), 0) / graded.length);
        })(),
      };
    }
    return {
      total: assignments.length,
      pending: assignments.reduce((sum, assignment) => sum + Number(assignment.needs_grading || 0), 0),
      submissions: assignments.reduce((sum, assignment) => sum + Number(assignment.submission_count || 0), 0),
      courses: new Set(assignments.map((assignment) => assignment.course_id)).size,
    };
  }, [assignments, isStudent]);

  const visible = useMemo(() => {
    if (!isStudent || filter === 'all') return assignments;
    if (filter === 'todo') return assignments.filter((assignment) => !assignment.submission_id);
    if (filter === 'submitted') return assignments.filter((assignment) => assignment.submission_id && assignment.grade === null);
    return assignments.filter((assignment) => assignment.grade !== null);
  }, [assignments, filter, isStudent]);

  const upload = async (assignment: Assignment) => {
    const file = selectedFiles[assignment.id];
    if (!file) {
      showToast('Choose a file first.');
      return;
    }
    setUploading(assignment.id);
    try {
      const form = new FormData();
      form.append('file', file);
      await apiUpload(`/assignments/${assignment.id}/submit`, form);
      showToast('Submission uploaded. Your instructor can grade it now.');
      setSelectedFiles((current) => ({ ...current, [assignment.id]: null }));
      await load();
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setUploading(null);
    }
  };

  const openSubmissions = async (assignment: Assignment) => {
    setReviewing(assignment);
    setLoadingSubmissions(true);
    setSubmissions([]);
    try {
      const data = await api<{ submissions: Submission[] }>(`/assignments/${assignment.id}/submissions`);
      setSubmissions(data.submissions);
    } catch (caught) {
      showToast(errorMessage(caught));
      setReviewing(null);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const grade = async (submission: Submission, gradeValue: number, feedback: string) => {
    try {
      await apiPut(`/submissions/${submission.id}/grade`, { grade: gradeValue, feedback });
      showToast(`Graded ${submission.student_name} · ${gradeValue}/100`);
      setSubmissions((current) =>
        current.map((item) => (item.id === submission.id ? { ...item, grade: gradeValue, feedback, status: 'graded' } : item)),
      );
      await load();
    } catch (caught) {
      showToast(errorMessage(caught));
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <button
            onClick={() => navigate(isStudent ? '/' : '/instructor')}
            className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-white/30 transition hover:text-white/65"
          >
            <ArrowLeft className="h-3 w-3" /> {isStudent ? 'Dashboard' : 'Instructor overview'}
          </button>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-300/75">
            {isStudent ? 'Coursework' : 'Assessment workflow'}
          </p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            {isStudent ? 'Assignments & feedback.' : 'Grading studio.'}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-white/35">
            {isStudent
              ? 'Upload your work, track due dates, and read instructor feedback in one place.'
              : 'Review submissions, attach rubric-based feedback, and return work quickly.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={load} className="btn-ghost h-10 px-3 text-[10px]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {!isStudent && (
            <button onClick={() => setShowCreate(true)} className="btn-primary h-10 px-4 text-[11px]">
              <Plus className="h-3.5 w-3.5" /> New assignment
            </button>
          )}
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isStudent ? (
          <>
            <Stat icon={Clock} label="To do" value={`${stats.todo}`} detail="Open assignments" tone="text-amber-300" />
            <Stat icon={Send} label="In review" value={`${stats.submitted}`} detail="Waiting for feedback" tone="text-sky-300" />
            <Stat icon={Award} label="Graded" value={`${stats.graded}`} detail={`${stats.average}% average`} tone="text-emerald-300" />
            <Stat icon={CalendarDays} label="Courses" value={`${new Set(assignments.map((assignment) => assignment.course_id)).size}`} detail="With coursework" tone="text-primary-300" />
          </>
        ) : (
          <>
            <Stat icon={FileText} label="Assignments" value={`${stats.total}`} detail={`${stats.courses} courses`} tone="text-primary-300" />
            <Stat icon={ClipboardCheck} label="Needs grading" value={`${stats.pending}`} detail="Submitted work" tone="text-rose-300" />
            <Stat icon={Paperclip} label="Submissions" value={`${stats.submissions}`} detail="Across your courses" tone="text-sky-300" />
            <Stat icon={CheckCircle2} label="Workflow" value="48h" detail="Feedback target" tone="text-emerald-300" />
          </>
        )}
      </section>

      {isStudent && (
        <div className="mt-4 flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 sm:w-fit">
          {filters.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`rounded-lg px-3 py-2 text-[9.5px] font-medium transition ${
                filter === item.value ? 'bg-primary-500/[0.16] text-primary-100' : 'text-white/35 hover:text-white/65'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        {loading && assignments.length === 0 &&
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-[190px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
          ))}
        {!loading && visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.01] py-16 text-center">
            <ClipboardCheck className="mx-auto h-6 w-6 text-white/20" />
            <p className="mt-2 text-[11px] text-white/40">Nothing in this view.</p>
            <p className="mt-1 text-[9px] text-white/22">{isStudent ? 'Try another filter or enroll in a course.' : 'Create an assignment to start collecting work.'}</p>
          </div>
        )}
        {visible.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            student={isStudent}
            uploading={uploading === assignment.id}
            selectedFile={selectedFiles[assignment.id] || null}
            onFile={(file) => setSelectedFiles((current) => ({ ...current, [assignment.id]: file }))}
            onUpload={() => upload(assignment)}
            onReview={() => openSubmissions(assignment)}
          />
        ))}
      </div>

      {reviewing && (
        <GradingDrawer
          assignment={reviewing}
          submissions={submissions}
          loading={loadingSubmissions}
          onClose={() => setReviewing(null)}
          onGrade={grade}
        />
      )}
      {showCreate && (
        <CreateAssignmentModal
          courses={courses}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function AssignmentCard({
  assignment,
  student,
  uploading,
  selectedFile,
  onFile,
  onUpload,
  onReview,
}: {
  assignment: Assignment;
  student: boolean;
  uploading: boolean;
  selectedFile: File | null;
  onFile: (file: File | null) => void;
  onUpload: () => void;
  onReview: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const due = dueTone(assignment.due_date);
  const hasSubmission = Boolean(assignment.submission_id);
  const isGraded = assignment.grade !== null && assignment.grade !== undefined;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:p-5">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${isGraded ? 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300' : 'border-primary-400/15 bg-primary-500/[0.07] text-primary-300'}`}>
          {isGraded ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[12.5px] font-semibold text-white/80">{assignment.title}</h2>
            <span className={`rounded border px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wide ${statusStyles(assignment.status)}`}>
              {isGraded ? 'graded' : assignment.status || 'not submitted'}
            </span>
            {!student && Number(assignment.needs_grading) > 0 && (
              <span className="rounded border border-rose-400/15 bg-rose-400/[0.07] px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wide text-rose-300">
                {assignment.needs_grading} to grade
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[8.5px] text-white/25">
            <span className="font-medium text-white/40">{assignment.course_title}</span>
            <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
            <span className={due.text}>{due.label}</span>
            <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
            <span>Posted {dateLabel(assignment.created_at)}</span>
          </p>
          <p className="mt-2 max-w-3xl text-[10px] leading-relaxed text-white/36">
            {assignment.instructions || 'No additional instructions. Upload your work as a PDF, ZIP, notebook, or source file.'}
          </p>

          {student && (
            <div className="mt-3">
              {isGraded ? (
                <div className="rounded-xl border border-emerald-400/12 bg-emerald-400/[0.035] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[20px] font-bold text-emerald-200">{assignment.grade}<span className="text-[10px] text-emerald-300/40">/100</span></span>
                    <span className="rounded border border-emerald-400/10 px-1.5 py-0.5 text-[7.5px] text-emerald-300/60">instructor feedback</span>
                  </div>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-white/40">{assignment.feedback || 'No written feedback provided.'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {assignment.file_url && (
                      <a href={assignment.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[8.5px] text-teal-300/65 hover:text-teal-200">
                        <Download className="h-2.5 w-2.5" /> {assignment.file_name || 'Your submission'}
                      </a>
                    )}
                    <button onClick={() => inputRef.current?.click()} className="ml-auto rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-[8px] text-white/35 transition hover:text-white/65">
                      Resubmit
                    </button>
                  </div>
                </div>
              ) : hasSubmission ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-400/12 bg-sky-400/[0.035] px-3 py-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-sky-300/70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9.5px] font-medium text-white/55">{assignment.file_name || 'Submission uploaded'}</p>
                    <p className="text-[8px] text-white/25">Submitted {dateLabel(assignment.submitted_at)} · waiting for grading</p>
                  </div>
                  {assignment.file_url && (
                    <a href={assignment.file_url} target="_blank" rel="noreferrer" className="rounded border border-white/[0.07] p-1.5 text-white/30 transition hover:text-white/65" aria-label="Download submission">
                      <Download className="h-3 w-3" />
                    </a>
                  )}
                  <button onClick={() => inputRef.current?.click()} className="rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-[8px] text-white/35 transition hover:text-white/65">
                    Resubmit
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-white/[0.09] bg-white/[0.012] p-3 sm:flex-row sm:items-center">
                  <button onClick={() => inputRef.current?.click()} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.025]"><UploadCloud className="h-3.5 w-3.5 text-white/30" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-[9.5px] font-medium text-white/48">{selectedFile ? selectedFile.name : 'Choose a file to submit'}</span>
                      <span className="block text-[8px] text-white/22">PDF, ZIP, notebook, or source · max 20 MB</span>
                    </span>
                  </button>
                  <button onClick={onUpload} disabled={!selectedFile || uploading} className="btn-primary h-8 px-3 text-[8.5px] disabled:cursor-not-allowed disabled:opacity-40">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    {uploading ? 'Uploading…' : 'Submit work'}
                  </button>
                </div>
              )}
              {hasSubmission && selectedFile && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary-400/15 bg-primary-500/[0.06] px-2.5 py-2">
                  <UploadCloud className="h-3 w-3 shrink-0 text-primary-300/70" />
                  <span className="min-w-0 flex-1 truncate text-[8.5px] text-white/50">
                    Replacement · {selectedFile.name}
                  </span>
                  <button
                    onClick={() => onFile(null)}
                    className="rounded border border-white/[0.07] px-2 py-1 text-[8px] text-white/35 transition hover:text-white/65"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onUpload}
                    disabled={uploading}
                    className="btn-primary h-7 px-2.5 text-[8px] disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
                    {uploading ? 'Submitting…' : 'Submit replacement'}
                  </button>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                accept=".pdf,.zip,.py,.js,.ts,.tsx,.java,.cpp,.c,.txt,.md,.ipynb"
                onChange={(event) => onFile(event.target.files?.[0] || null)}
              />
            </div>
          )}

          {!student && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={onReview} className="btn-primary h-8 px-3 text-[8.5px]">
                <ClipboardCheck className="h-3 w-3" /> Review submissions
              </button>
              <span className="flex items-center gap-1 text-[8.5px] text-white/25">
                <Paperclip className="h-2.5 w-2.5" /> {assignment.submission_count || 0} submitted
              </span>
              {Number(assignment.needs_grading) > 0 && <span className="text-[8.5px] text-rose-300/60">{assignment.needs_grading} awaiting grade</span>}
            </div>
          )}
        </div>
        {isGraded && (
          <div className="flex shrink-0 flex-col items-center rounded-xl border border-emerald-400/12 bg-emerald-400/[0.035] px-3 py-2">
            <span className="font-display text-[18px] font-bold leading-none text-emerald-200">{assignment.grade}</span>
            <span className="mt-0.5 text-[7px] uppercase tracking-wide text-emerald-300/45">score</span>
          </div>
        )}
      </div>
    </article>
  );
}

function GradingDrawer({
  assignment,
  submissions,
  loading,
  onClose,
  onGrade,
}: {
  assignment: Assignment;
  submissions: Submission[];
  loading: boolean;
  onClose: () => void;
  onGrade: (submission: Submission, grade: number, feedback: string) => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Grade submissions">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close grading panel" />
      <section className="relative flex h-full w-full max-w-[620px] flex-col border-l border-white/[0.08] bg-[#0b0912] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-white/25">Grading queue</p>
            <h2 className="mt-1 font-display text-[17px] font-semibold text-white/90">{assignment.title}</h2>
            <p className="mt-0.5 text-[9px] text-white/25">{assignment.course_title} · {submissions.length} submissions</p>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {loading && <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-primary-300/60" /></div>}
          {!loading && submissions.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/[0.09] py-16 text-center">
              <ClipboardCheck className="mx-auto h-6 w-6 text-white/20" />
              <p className="mt-2 text-[11px] text-white/40">No submissions yet.</p>
            </div>
          )}
          {submissions.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} onGrade={onGrade} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SubmissionCard({ submission, onGrade }: { submission: Submission; onGrade: (submission: Submission, grade: number, feedback: string) => Promise<void> }) {
  const [grade, setGrade] = useState(submission.grade === null ? '' : String(submission.grade));
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const numeric = Number(grade);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return;
    setSaving(true);
    try {
      await onGrade(submission, numeric, feedback);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold text-white/68">{submission.student_name}</p>
          <p className="text-[8px] text-white/22">{submission.student_email} · {dateLabel(submission.submitted_at)}</p>
        </div>
        <span className={`rounded border px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wide ${statusStyles(submission.status)}`}>{submission.status}</span>
        <a href={submission.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded border border-white/[0.07] px-2 py-1 text-[8px] text-white/35 transition hover:text-white/65">
          <Download className="h-2.5 w-2.5" /> <span className="max-w-[120px] truncate">{submission.file_name}</span>
        </a>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[90px_1fr]">
        <label className="block">
          <span className="mb-1 block text-[7.5px] uppercase tracking-[0.1em] text-white/25">Grade</span>
          <input type="number" min="0" max="100" value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="0–100" className="form-input h-8 text-[10px]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[7.5px] uppercase tracking-[0.1em] text-white/25">Feedback</span>
          <input value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="What should the learner improve?" className="form-input h-8 text-[10px]" />
        </label>
      </div>
      <div className="mt-2 flex justify-end">
        <button onClick={save} disabled={saving || grade === ''} className="btn-primary h-7 px-3 text-[8px] disabled:opacity-40">
          {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
          {submission.status === 'graded' ? 'Update grade' : 'Save grade'}
        </button>
      </div>
    </div>
  );
}

function CreateAssignmentModal({ courses, onClose, onCreated }: { courses: CourseOption[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ course_id: courses[0]?.id || '', title: '', instructions: '', due_date: '', rubric: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.course_id || form.title.trim().length < 3) {
      showToast('Choose a course and add an assignment title.');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/assignments', {
        course_id: form.course_id,
        title: form.title,
        instructions: form.instructions,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        rubric: form.rubric ? { criteria: form.rubric } : {},
      });
      showToast('Assignment published to learners.');
      await onCreated();
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create assignment">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close create assignment" />
      <form onSubmit={submit} className="relative w-full max-w-[520px] rounded-2xl border border-white/[0.09] bg-[#100d19] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-primary-300/70">New assessment</p>
            <h2 className="mt-1 font-display text-[19px] font-semibold text-white/90">Create an assignment</h2>
          </div>
          <button type="button" onClick={onClose} className="icon-btn"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block"><span className="form-label">Course</span>
            <select value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })} className="form-input h-10" required>
              <option value="" disabled>Select a course</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label className="block"><span className="form-label">Title</span>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Implement Dijkstra with a heap" className="form-input h-10" required minLength={3} />
          </label>
          <label className="block"><span className="form-label">Instructions</span>
            <textarea value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} rows={4} placeholder="What should learners submit? Include constraints and acceptance criteria." className="form-input min-h-[100px] resize-none py-2.5" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="form-label">Due date</span>
              <input type="datetime-local" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} className="form-input h-10" />
            </label>
            <label className="block"><span className="form-label">Rubric notes</span>
              <input value={form.rubric} onChange={(event) => setForm({ ...form, rubric: event.target.value })} placeholder="Correctness, complexity, clarity" className="form-input h-10" />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost h-9 px-3 text-[9.5px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-9 px-4 text-[9.5px] disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Publish assignment
          </button>
        </div>
      </form>
    </div>
  );
}

function Stat({ icon: Icon, label, value, detail, tone }: { icon: typeof Clock; label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#100d19] p-4">
      <span className={`grid h-8 w-8 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.025] ${tone}`}><Icon className="h-3.5 w-3.5" /></span>
      <p className="mt-2.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">{label}</p>
      <p className="mt-1 font-display text-[20px] font-bold leading-none text-white">{value}</p>
      <p className="mt-1.5 text-[8.5px] text-white/25">{detail}</p>
    </div>
  );
}
