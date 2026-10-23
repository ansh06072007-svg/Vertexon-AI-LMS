import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Flag,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, apiPost, apiDelete, errorMessage } from '../lib/api';

type Course = { id: string; title: string; category: string; status: string };

type Thread = {
  id: string;
  course_id: string;
  created_by: string;
  title: string;
  created_at: string;
  author_name: string;
  course_title: string;
  post_count: number;
  flagged_count: number;
  last_activity: string | null;
};

type Post = {
  id: string;
  thread_id: string;
  user_id: string;
  content: string;
  is_flagged: number;
  created_at: string;
  author_name: string;
  author_role: string;
};

const dateLabel = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function Community() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadThreads = async () => {
    try {
      const data = await api<{ threads: Thread[] }>('/discussions');
      setThreads(data.threads);
      setSelectedId((current) => current || data.threads[0]?.id || null);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api<{ courses: Course[] }>('/courses?limit=50'),
      api<{ threads: Thread[] }>('/discussions'),
    ])
      .then(([courseData, threadData]) => {
        setCourses(courseData.courses);
        setThreads(threadData.threads);
        setSelectedId(threadData.threads[0]?.id || null);
      })
      .catch((caught) => showToast(errorMessage(caught)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      setPosts([]);
      return;
    }
    setLoadingThread(true);
    api<{ thread: Thread; posts: Post[] }>(`/discussions/${selectedId}`)
      .then((data) => {
        setThread(data.thread);
        setPosts(data.posts);
      })
      .catch((caught) => showToast(errorMessage(caught)))
      .finally(() => setLoadingThread(false));
  }, [selectedId]);

  const visibleThreads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return threads.filter((item) => {
      if (filter !== 'all' && item.course_id !== filter) return false;
      if (!needle) return true;
      return item.title.toLowerCase().includes(needle) || item.course_title.toLowerCase().includes(needle);
    });
  }, [threads, filter, query]);

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!thread || !reply.trim()) return;
    setSending(true);
    try {
      const data = await apiPost<{ post: Post }>(`/discussions/${thread.id}/posts`, { content: reply.trim() });
      setPosts((current) => [...current, { ...data.post, author_name: user?.full_name || 'You', author_role: user?.role || 'student' }]);
      setReply('');
      setThreads((current) =>
        current.map((item) =>
          item.id === thread.id ? { ...item, post_count: item.post_count + 1, last_activity: new Date().toISOString() } : item,
        ),
      );
      window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  const flagPost = async (post: Post) => {
    if (post.is_flagged) return;
    try {
      await apiPost(`/discussion-posts/${post.id}/flag`);
      setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, is_flagged: 1 } : item)));
      showToast('Reported to moderators.');
    } catch (caught) {
      showToast(errorMessage(caught));
    }
  };

  const removePost = async (post: Post) => {
    if (!window.confirm('Remove this reply from the discussion?')) return;
    try {
      await apiDelete(`/discussion-posts/${post.id}`);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      showToast('Reply removed.');
    } catch (caught) {
      showToast(errorMessage(caught));
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <button
            onClick={() => navigate(user?.role === 'student' ? '/' : user?.role === 'instructor' ? '/instructor' : '/admin')}
            className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-white/30 transition hover:text-white/65"
          >
            <ArrowLeft className="h-3 w-3" /> Back to workspace
          </button>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300/75">Community &amp; discussions</p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Learn out loud.
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-white/35">
            Ask a question, share a shortcut, or help someone past a hard concept. Instructors and moderators are here too.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={loadThreads} className="btn-ghost h-10 px-3 text-[10px]"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
          <button onClick={() => setShowNew(true)} className="btn-primary h-10 px-4 text-[11px]"><Plus className="h-3.5 w-3.5" /> Start a discussion</button>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
          <div className="border-b border-white/[0.055] p-4">
            <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-black/15 px-3">
              <Search className="h-3.5 w-3.5 text-white/25" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search discussions..." className="h-9 min-w-0 flex-1 bg-transparent text-[10.5px] text-white/70 placeholder:text-white/20 focus:outline-none" aria-label="Search discussions" />
            </div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="form-input mt-2 h-9 text-[9.5px]" aria-label="Filter discussions by course">
              <option value="all">All courses</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </div>
          <div className="max-h-[570px] divide-y divide-white/[0.045] overflow-y-auto">
            {loading && Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse border-b border-white/[0.04] bg-white/[0.012]" />)}
            {!loading && visibleThreads.length === 0 && (
              <div className="px-4 py-12 text-center"><MessageCircle className="mx-auto h-5 w-5 text-white/20" /><p className="mt-2 text-[10px] text-white/35">No threads here yet.</p></div>
            )}
            {visibleThreads.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full px-4 py-3.5 text-left transition ${selectedId === item.id ? 'bg-primary-500/[0.08]' : 'hover:bg-white/[0.02]'}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${selectedId === item.id ? 'bg-primary-300' : 'bg-white/15'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[10.5px] font-medium leading-snug text-white/68">{item.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[8px] text-white/25">
                      <span className="truncate">{item.course_title}</span>
                      <span className="h-[2px] w-[2px] rounded-full bg-white/15" />
                      <span>{item.post_count} replies</span>
                      {item.flagged_count > 0 && <span className="flex items-center gap-0.5 text-rose-300/60"><Flag className="h-2 w-2" />{item.flagged_count}</span>}
                    </p>
                    <p className="mt-1 text-[7.5px] text-white/18">{item.author_name} · {dateLabel(item.last_activity || item.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-h-[560px] overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
          {loadingThread ? (
            <div className="grid h-[560px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary-300/60" /></div>
          ) : !thread ? (
            <div className="grid h-[560px] place-items-center px-6 text-center">
              <div><MessageSquare className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-[12px] text-white/45">Pick a discussion to join.</p><p className="mt-1 text-[9.5px] text-white/25">Or start a new thread for your course.</p><button onClick={() => setShowNew(true)} className="btn-primary mt-4 h-9 px-4 text-[10px]"><Plus className="h-3 w-3" /> New discussion</button></div>
            </div>
          ) : (
            <div className="flex min-h-[560px] flex-col">
              <div className="border-b border-white/[0.055] px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-teal-300/50">{thread.course_title}</p>
                    <h2 className="mt-1 font-display text-[17px] font-semibold leading-snug text-white/90">{thread.title}</h2>
                  </div>
                  <button onClick={() => navigate('/community')} className="flex items-center gap-1 text-[8.5px] text-primary-300/55 transition hover:text-primary-200">Community <ArrowUpRight className="h-2.5 w-2.5" /></button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[8.5px] text-white/25">
                  <Avatar name={thread.author_name} size={18} />
                  <span>Started by {thread.author_name}</span><span className="h-[2px] w-[2px] rounded-full bg-white/15" /><span>{dateLabel(thread.created_at)}</span>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                {posts.map((post, index) => (
                  <div key={post.id} className="group flex gap-2.5">
                    <Avatar name={post.author_name} size={28} />
                    <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-white/[0.055] bg-white/[0.018] px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[9.5px] font-semibold text-white/65">{post.author_name}</p>
                        {post.author_role !== 'student' && (
                          <span className="flex items-center gap-0.5 rounded border border-primary-400/15 bg-primary-500/[0.07] px-1 py-[1px] text-[6.5px] font-bold uppercase tracking-wide text-primary-200/75">
                            <ShieldCheck className="h-1.5 w-1.5" /> {post.author_role}
                          </span>
                        )}
                        <span className="ml-auto text-[7.5px] text-white/18">{dateLabel(post.created_at)}</span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-line text-[10px] leading-relaxed text-white/45">{post.content}</p>
                      <div className="mt-1.5 flex items-center justify-end gap-2 opacity-0 transition group-hover:opacity-100">
                        <button onClick={() => flagPost(post)} disabled={Boolean(post.is_flagged)} className={`flex items-center gap-1 text-[7.5px] transition ${post.is_flagged ? 'text-rose-300/50' : 'text-white/18 hover:text-rose-300/70'}`}>
                          <Flag className="h-2 w-2" /> {post.is_flagged ? 'Reported' : 'Report'}
                        </button>
                        {(user?.role === 'admin' || user?.role === 'instructor') && (
                          <button onClick={() => removePost(post)} className="flex items-center gap-1 text-[7.5px] text-white/18 transition hover:text-rose-300/70"><Trash2 className="h-2 w-2" /> Remove</button>
                        )}
                      </div>
                      {index === 0 && <span className="mt-1 block text-[7px] text-white/12">Original post</span>}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <form onSubmit={sendReply} className="border-t border-white/[0.055] p-3 sm:p-4">
                <div className="flex items-end gap-2 rounded-xl border border-white/[0.07] bg-black/15 p-2 focus-within:border-primary-400/30">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={2}
                    placeholder="Add a helpful reply…"
                    className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-1 py-1 text-[10.5px] leading-relaxed text-white/70 placeholder:text-white/20 focus:outline-none"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendReply(event as unknown as FormEvent);
                      }
                    }}
                  />
                  <button type="submit" disabled={!reply.trim() || sending} className="btn-primary h-8 px-3 text-[8.5px] disabled:opacity-40">
                    {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Reply
                  </button>
                </div>
                <p className="mt-1.5 text-[7.5px] text-white/18">Be specific, be kind. Enter to send · Shift+Enter for a new line.</p>
              </form>
            </div>
          )}
        </section>
      </div>

      {showNew && (
        <NewThreadModal
          courses={courses}
          onClose={() => setShowNew(false)}
          onCreated={async (threadId) => {
            setShowNew(false);
            await loadThreads();
            setSelectedId(threadId);
          }}
        />
      )}
    </div>
  );
}

function NewThreadModal({ courses, onClose, onCreated }: { courses: Course[]; onClose: () => void; onCreated: (threadId: string) => Promise<void> }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ course_id: courses[0]?.id || '', title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.course_id || form.title.trim().length < 4 || !form.content.trim()) {
      showToast('Choose a course, add a title, and write an opening post.');
      return;
    }
    setSaving(true);
    try {
      const data = await apiPost<{ thread: Thread }>('/discussions', form);
      showToast('Discussion started.');
      await onCreated(data.thread.id);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Start a discussion">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close new discussion" />
      <form onSubmit={submit} className="relative w-full max-w-[520px] rounded-2xl border border-white/[0.09] bg-[#100d19] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div><p className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-teal-300/70">Study circle</p><h2 className="mt-1 font-display text-[19px] font-semibold text-white/90">Start a discussion</h2></div>
          <button type="button" onClick={onClose} className="icon-btn"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block"><span className="form-label">Course</span>
            <select value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })} className="form-input h-10" required>
              <option value="" disabled>Select a course</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label className="block"><span className="form-label">Question or topic</span>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Why does negative edge break Dijkstra?" className="form-input h-10" required minLength={4} />
          </label>
          <label className="block"><span className="form-label">Opening post</span>
            <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={5} placeholder="Explain what you have tried and where you are stuck…" className="form-input min-h-[120px] resize-none py-2.5" required />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost h-9 px-3 text-[9.5px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-9 px-4 text-[9.5px] disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />} Post discussion
          </button>
        </div>
      </form>
    </div>
  );
}
