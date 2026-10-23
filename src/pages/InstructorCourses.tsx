import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  FilePlus2,
  Layers,
  Loader2,
  Megaphone,
  Plus,
  Rocket,
  Sparkles,
  Video,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { api, apiPost, apiUpload, errorMessage } from '../lib/api';

type Lecture = { id: string; title: string; duration_seconds: number; order_index: number };
type Module = { id: string; title: string; order_index: number; lectures: Lecture[] };
type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  status: string;
  rating: number;
  price: number;
  learners: number;
  avg_progress: number;
  quiz_average: number;
  revenue: number;
  pending_submissions: number;
  glyph: string;
  tone: string;
  modules: Module[];
};

const categories = ['Data', 'Development', 'AI/ML', 'Design', 'Business'];
const difficulties = ['Beginner', 'Intermediate', 'Advanced'];

export default function InstructorCourses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Development',
    difficulty: 'Intermediate',
    price: '0',
    thumbnail_url: '',
  });

  const load = async () => {
    try {
      const response = await api<{ courses: Course[] }>('/instructor/courses');
      setCourses(response.courses);
      setExpanded((current) => current || response.courses[0]?.id || null);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(
    () => ({
      courses: courses.length,
      learners: courses.reduce((sum, course) => sum + course.learners, 0),
      lectures: courses.reduce((sum, course) => sum + course.modules.reduce((count, module) => count + module.lectures.length, 0), 0),
    }),
    [courses],
  );

  const createCourse = async (event: FormEvent) => {
    event.preventDefault();
    if (form.title.trim().length < 4) {
      showToast('Course title must be at least 4 characters.');
      return;
    }
    setCreating(true);
    try {
      let thumbnailUrl = form.thumbnail_url.trim();
      if (thumbnailFile) {
        const upload = new FormData();
        upload.append('file', thumbnailFile);
        const uploaded = await apiUpload<{ file: { url: string } }>('/uploads/material', upload);
        thumbnailUrl = uploaded.file.url;
      }
      const response = await apiPost<{ course: Course }>('/courses', {
        ...form,
        price: Number(form.price) || 0,
        thumbnail_url: thumbnailUrl,
      });
      showToast('Course created · sent to admin for approval.');
      setForm({ title: '', description: '', category: 'Development', difficulty: 'Intermediate', price: '0', thumbnail_url: '' });
      setThumbnailFile(null);
      await load();
      setExpanded(response.course.id);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <button onClick={() => navigate('/instructor')} className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-white/30 transition hover:text-white/65">
            <ArrowLeft className="h-3 w-3" /> Instructor overview
          </button>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-300/75">Course authoring</p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Build the next <span className="text-gradient">great lesson.</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-white/35">
            Create a course, structure modules, add lecture transcripts, and generate review-ready AI quizzes.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <div><p className="text-[8px] uppercase tracking-[0.12em] text-white/25">Courses</p><p className="mt-0.5 font-display text-[16px] font-semibold text-white/80">{totals.courses}</p></div>
          <span className="h-7 w-px bg-white/[0.07]" />
          <div><p className="text-[8px] uppercase tracking-[0.12em] text-white/25">Learners</p><p className="mt-0.5 font-display text-[16px] font-semibold text-white/80">{totals.learners}</p></div>
          <span className="h-7 w-px bg-white/[0.07]" />
          <div><p className="text-[8px] uppercase tracking-[0.12em] text-white/25">Lectures</p><p className="mt-0.5 font-display text-[16px] font-semibold text-white/80">{totals.lectures}</p></div>
        </div>
      </header>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          {loading && <div className="h-[420px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />}
          {!loading && courses.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.01] px-6 py-14 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03]"><BookOpen className="h-5 w-5 text-white/30" /></span>
              <p className="mt-3 text-[12px] font-medium text-white/55">No courses yet.</p>
              <p className="mt-1 text-[10px] text-white/25">Create one from the panel on the right.</p>
            </div>
          )}
          {courses.map((course) => {
            const lectureCount = course.modules.reduce((count, module) => count + module.lectures.length, 0);
            const open = expanded === course.id;
            return (
              <article key={course.id} className="overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
                <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${course.tone || 'from-[#25184b] to-[#121021]'} font-mono text-[13px] font-bold text-white/60`}>
                    {course.glyph || 'VC'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[13px] font-semibold text-white/82">{course.title}</h2>
                      <span className={`rounded border px-1.5 py-[2px] text-[7px] font-bold uppercase tracking-wide ${course.status === 'approved' ? 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300' : course.status === 'rejected' ? 'border-rose-400/15 bg-rose-400/[0.07] text-rose-300' : 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300'}`}>
                        {course.status}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-white/25">
                      <span>{course.category}</span><span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span>{course.difficulty}</span><span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span>{course.modules.length} modules</span><span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span>{lectureCount} lectures</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <p className="text-[8px] text-white/25">Learners</p>
                      <p className="mt-0.5 font-mono text-[11px] text-white/60">{course.learners}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-[8px] text-white/25">Completion</p>
                      <p className="mt-0.5 font-mono text-[11px] text-teal-200/65">{course.avg_progress}%</p>
                    </div>
                    <button onClick={() => setExpanded(open ? null : course.id)} className="btn-ghost h-8 px-2.5 text-[9px]">
                      Curriculum <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-white/[0.055] bg-[#0c0a13] px-4 py-4 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/25">Curriculum builder</p>
                      <button
                        onClick={() => navigate('/instructor/analytics')}
                        className="flex items-center gap-1 text-[9px] text-primary-300/70 transition hover:text-primary-200"
                      >
                        Course analytics <BarChart3 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {course.modules.map((module, moduleIndex) => (
                        <ModuleBlock key={module.id} module={module} index={moduleIndex} courseId={course.id} onChanged={load} />
                      ))}
                      {course.modules.length === 0 && (
                        <p className="rounded-lg border border-dashed border-white/[0.07] px-3 py-4 text-center text-[10px] text-white/25">No modules yet. Add a module to start building.</p>
                      )}
                      <AddModule courseId={course.id} onCreated={load} />
                    </div>
                    {course.status === 'pending' && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2">
                        <Clock className="mt-0.5 h-3 w-3 shrink-0 text-amber-300/70" />
                        <p className="text-[8.5px] leading-relaxed text-amber-100/50">This course is in the admin review queue. You can keep building curriculum while it waits.</p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <aside className="space-y-4">
          <form onSubmit={createCourse} className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-primary-400/15 bg-primary-500/[0.08]"><Rocket className="h-3.5 w-3.5 text-primary-200" /></span>
              <div><h2 className="text-[12.5px] font-semibold text-white/85">Create a course</h2><p className="text-[8px] text-white/25">Submitted for admin approval</p></div>
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Course title">
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Advanced React Patterns" className="form-input" required minLength={4} />
              </Field>
              <Field label="Short description">
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What will learners be able to do?" rows={3} className="form-input min-h-[76px] resize-none py-2.5" />
              </Field>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Category">
                  <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="form-input appearance-none">
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </Field>
                <Field label="Level">
                  <select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })} className="form-input appearance-none">
                    {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Price (INR)">
                <input type="number" min="0" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="form-input" />
              </Field>
              <Field label="Thumbnail URL (optional)">
                <input
                  value={form.thumbnail_url}
                  onChange={(event) => setForm({ ...form, thumbnail_url: event.target.value })}
                  placeholder="https://… or upload below"
                  className="form-input"
                />
              </Field>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed border-white/[0.09] bg-white/[0.015] px-3 py-2.5 text-[9px] text-white/35 transition hover:border-primary-400/25 hover:text-white/60">
                <span className="min-w-0 truncate">{thumbnailFile ? thumbnailFile.name : 'Upload course cover image'}</span>
                <span className="shrink-0 rounded border border-white/[0.08] px-2 py-1 text-[8px]">Browse</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="sr-only"
                  onChange={(event) => setThumbnailFile(event.target.files?.[0] || null)}
                />
              </label>
              <button type="submit" disabled={creating} className="btn-primary h-10 w-full text-[11px] disabled:opacity-60">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create course
              </button>
            </div>
          </form>

          <section className="rounded-2xl border border-teal2/15 bg-gradient-to-br from-[#0f2427] to-[#100d19] p-4">
            <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-teal-300" /><h2 className="text-[12px] font-semibold text-white/85">AI-assisted authoring</h2></div>
            <p className="mt-2 text-[9px] leading-relaxed text-white/28">Add a lecture transcript, then generate a grounded quiz draft. Drafts stay private until you review and publish them.</p>
            <div className="mt-3 space-y-1.5 text-[8.5px] text-white/35">
              <p className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-teal2" /> Transcript chunking + keyword embedding</p>
              <p className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-teal2" /> Source-cited student answers</p>
              <p className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-teal2" /> Instructor review before publishing</p>
            </div>
          </section>

          <AnnouncementComposer courses={courses} />
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-white/30">{label}</span>
      {children}
    </label>
  );
}

function ModuleBlock({ module, index, onChanged }: { module: Module; index: number; courseId: string; onChanged: () => Promise<void> }) {
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lecture, setLecture] = useState({ title: '', duration: '1200', transcript: '', videoUrl: '' });
  const [resource, setResource] = useState<File | null>(null);

  const addLecture = async (event: FormEvent) => {
    event.preventDefault();
    if (!lecture.title.trim()) return;
    setSaving(true);
    try {
      let resourceUrls: string[] = [];
      let uploadedUrl = '';
      if (resource) {
        const upload = new FormData();
        upload.append('file', resource);
        const uploaded = await apiUpload<{ file: { url: string } }>('/uploads/material', upload);
        uploadedUrl = uploaded.file.url;
        resourceUrls = [uploadedUrl];
      }
      const uploadedIsVideo = /\.(mp4|webm)$/i.test(resource?.name || '');
      const videoUrl = lecture.videoUrl.trim() || (uploadedIsVideo ? uploadedUrl : '');
      await apiPost(`/courses/modules/${module.id}/lectures`, {
        title: lecture.title,
        duration_seconds: Number(lecture.duration) || 0,
        transcript: lecture.transcript,
        video_url: videoUrl || undefined,
        resource_urls: resourceUrls,
      });
      showToast(
        resource
          ? 'Lecture added, material attached, and transcript indexed for RAG.'
          : 'Lecture added and transcript indexed for RAG.',
      );
      setLecture({ title: '', duration: '1200', transcript: '', videoUrl: '' });
      setResource(null);
      setAdding(false);
      await onChanged();
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.055] bg-white/[0.015]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="grid h-5 w-5 place-items-center rounded bg-primary-500/10 font-mono text-[8px] text-primary-200">{index + 1}</span>
        <p className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-white/65">{module.title}</p>
        <span className="text-[8px] text-white/22">{module.lectures.length} lectures</span>
        <button onClick={() => setAdding((current) => !current)} className="flex items-center gap-1 rounded border border-white/[0.06] px-1.5 py-1 text-[8px] text-white/35 transition hover:text-white/70">
          <FilePlus2 className="h-2.5 w-2.5" /> Lecture
        </button>
      </div>
      {module.lectures.length > 0 && (
        <div className="space-y-1 border-t border-white/[0.045] px-3 py-2">
          {module.lectures.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded px-1 py-1 text-[9px] text-white/35">
              <Video className="h-3 w-3 text-white/20" />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <span className="font-mono text-[8px] text-white/20">{Math.round(item.duration_seconds / 60)}m</span>
              <button onClick={async () => { try { await apiPost(`/ai/lectures/${item.id}/generate-quiz`); showToast('AI quiz draft generated · review it in the grading area.'); } catch (caught) { showToast(errorMessage(caught)); } }} className="flex items-center gap-1 rounded border border-teal2/15 bg-teal2/[0.05] px-1.5 py-0.5 text-[7px] text-teal-200/80 transition hover:bg-teal2/[0.1]">
                <Sparkles className="h-2 w-2" /> AI quiz
              </button>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <form onSubmit={addLecture} className="space-y-2 border-t border-white/[0.045] px-3 py-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
            <input value={lecture.title} onChange={(event) => setLecture({ ...lecture, title: event.target.value })} placeholder="Lecture title" className="form-input h-8 text-[10px]" required />
            <input type="number" min="0" value={lecture.duration} onChange={(event) => setLecture({ ...lecture, duration: event.target.value })} placeholder="Seconds" className="form-input h-8 text-[10px]" />
          </div>
          <input value={lecture.videoUrl} onChange={(event) => setLecture({ ...lecture, videoUrl: event.target.value })} placeholder="Video URL (optional) — MP4 / HLS / uploaded file" className="form-input h-8 text-[10px]" />
          <textarea value={lecture.transcript} onChange={(event) => setLecture({ ...lecture, transcript: event.target.value })} placeholder="Paste a transcript so the AI tutor can index this lecture…" rows={3} className="form-input min-h-[66px] resize-none py-2 text-[10px]" />
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed border-white/[0.09] bg-white/[0.015] px-2.5 py-2 text-[8.5px] text-white/32 transition hover:border-teal2/25 hover:text-white/55">
            <span className="min-w-0 truncate">{resource ? resource.name : 'Attach PDF, slides, notebook, image, or video'}</span>
            <span className="shrink-0 rounded border border-white/[0.08] px-1.5 py-0.5 text-[7.5px]">Browse</span>
            <input
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.zip,.txt,.md,.csv,.json,.ipynb,.py,.js,.ts,.tsx,.java,.cpp,.c,.png,.jpg,.jpeg,.webp,.mp4,.webm"
              className="sr-only"
              onChange={(event) => setResource(event.target.files?.[0] || null)}
            />
          </label>
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setAdding(false)} className="btn-ghost h-7 px-2 text-[8.5px]">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary h-7 px-2.5 text-[8.5px] disabled:opacity-50">{saving ? 'Saving…' : 'Add lecture'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function AnnouncementComposer({ courses }: { courses: Course[] }) {
  const { showToast } = useToast();
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!courseId && courses[0]) setCourseId(courses[0].id);
  }, [courses, courseId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!courseId || !content.trim()) {
      showToast('Choose a course and write an announcement.');
      return;
    }
    setSending(true);
    try {
      await apiPost(`/courses/${courseId}/announcements`, {
        title: title.trim() || 'Course announcement',
        content: content.trim(),
      });
      showToast('Announcement sent to enrolled learners and queued for email.');
      setTitle('');
      setContent('');
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-primary-400/15 bg-gradient-to-br from-[#1a1230] to-[#100d19] p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-primary-400/15 bg-primary-500/[0.08]">
          <Megaphone className="h-3.5 w-3.5 text-primary-200" />
        </span>
        <div>
          <h2 className="text-[12px] font-semibold text-white/85">Post an announcement</h2>
          <p className="text-[8px] text-white/25">In-app + email to every enrolled learner</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="form-input h-8 text-[9.5px]" aria-label="Announcement course">
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Subject (optional)" className="form-input h-8 text-[9.5px]" />
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Share a deadline, office-hours change, or new material…" rows={3} className="form-input min-h-[68px] resize-none py-2 text-[9.5px]" required />
      </div>
      <button type="submit" disabled={sending || !courses.length} className="btn-primary mt-3 h-8 w-full text-[9px] disabled:opacity-50">
        {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
        Send announcement
      </button>
    </form>
  );
}

function AddModule({ courseId, onCreated }: { courseId: string; onCreated: () => Promise<void> }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiPost(`/courses/${courseId}/modules`, { title });
      showToast('Module added.');
      setTitle('');
      setOpen(false);
      await onCreated();
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.09] py-2 text-[8.5px] text-white/30 transition hover:border-primary-400/25 hover:text-primary-200">
        <Layers className="h-2.5 w-2.5" /> Add module
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border border-primary-400/20 bg-primary-500/[0.04] p-2">
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Module title" className="form-input h-7 flex-1 text-[9px]" autoFocus required />
      <button type="submit" disabled={saving} className="btn-primary h-7 px-2 text-[8px] disabled:opacity-50">{saving ? '…' : 'Add'}</button>
      <button type="button" onClick={() => setOpen(false)} className="text-[8px] text-white/30 hover:text-white/60">Cancel</button>
    </form>
  );
}
