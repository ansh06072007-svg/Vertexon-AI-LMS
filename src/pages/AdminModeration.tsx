import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Flag,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import { api, apiPut, errorMessage } from '../lib/api';

type FlaggedPost = {
  id: string;
  thread_id: string;
  thread_title: string;
  course_id: string;
  course_title: string;
  author_name: string;
  author_email: string;
  content: string;
  created_at: string;
};

const dateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function AdminModeration() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [posts, setPosts] = useState<FlaggedPost[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ posts: FlaggedPost[] }>('/admin/moderation/flagged');
      setPosts(data.posts);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return posts;
    return posts.filter(
      (post) =>
        post.content.toLowerCase().includes(needle) ||
        post.author_name.toLowerCase().includes(needle) ||
        post.thread_title.toLowerCase().includes(needle),
    );
  }, [posts, query]);

  const act = async (post: FlaggedPost, action: 'dismiss' | 'remove') => {
    setBusy(post.id);
    try {
      await apiPut(`/admin/moderation/posts/${post.id}`, { action });
      setPosts((current) => current.filter((item) => item.id !== post.id));
      showToast(action === 'remove' ? 'Post removed from the community.' : 'Flag dismissed.');
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <button
            onClick={() => navigate('/admin')}
            className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-white/30 transition hover:text-white/65"
          >
            <ArrowLeft className="h-3 w-3" /> Admin overview
          </button>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300/75">Trust &amp; safety</p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Moderation queue.
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-white/35">
            Reports from learners and instructors. Dismiss false positives, remove harmful content, and keep the forum useful.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-rose-400/15 bg-rose-500/[0.04] px-4 py-2.5">
          <ShieldAlert className="h-4 w-4 text-rose-300" />
          <div>
            <p className="text-[8px] uppercase tracking-[0.12em] text-white/25">Open reports</p>
            <p className="mt-0.5 font-display text-[16px] font-semibold text-white/85">{posts.length}</p>
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-[#100d19] px-3.5 sm:max-w-md">
          <Search className="h-4 w-4 shrink-0 text-white/25" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search report, author, or thread..."
            className="h-full min-w-0 flex-1 bg-transparent text-[11.5px] text-white/75 placeholder:text-white/20 focus:outline-none"
            aria-label="Search reports"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost h-10 px-3 text-[10px]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => navigate('/community')} className="btn-ghost h-10 px-3 text-[10px]">
            <MessageSquare className="h-3.5 w-3.5" /> Open community
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {loading && posts.length === 0 &&
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-[170px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
          ))}
        {!loading && visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-emerald-400/15 bg-emerald-400/[0.02] py-16 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-emerald-400/15 bg-emerald-400/[0.06]">
              <Check className="h-5 w-5 text-emerald-300/70" />
            </span>
            <p className="mt-3 text-[12px] font-medium text-white/50">Moderation queue is clear.</p>
            <p className="mt-1 text-[9.5px] text-white/25">No reported posts match this view.</p>
          </div>
        )}
        {visible.map((post) => (
          <article key={post.id} className="rounded-2xl border border-rose-400/12 bg-[#130e17] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Avatar name={post.author_name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11.5px] font-semibold text-white/75">{post.author_name}</p>
                  <span className="rounded border border-rose-400/15 bg-rose-400/[0.07] px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wide text-rose-300">
                    reported
                  </span>
                  <span className="text-[8.5px] text-white/22">{post.author_email}</span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[8.5px] text-white/25">
                  <span>in</span>
                  <span className="font-medium text-white/45">{post.thread_title}</span>
                  <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                  <span>{post.course_title}</span>
                  <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                  <span>{dateLabel(post.created_at)}</span>
                </p>
                <blockquote className="mt-3 rounded-xl border border-white/[0.055] bg-black/20 px-3.5 py-3 text-[10.5px] leading-relaxed text-white/48">
                  “{post.content}”
                </blockquote>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => act(post, 'dismiss')}
                    disabled={busy === post.id}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[8.5px] font-medium text-white/45 transition hover:text-white/75 disabled:opacity-50"
                  >
                    {busy === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Dismiss report
                  </button>
                  <button
                    onClick={() => act(post, 'remove')}
                    disabled={busy === post.id}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-400/15 bg-rose-400/[0.07] px-3 py-2 text-[8.5px] font-medium text-rose-200 transition hover:bg-rose-400/[0.13] disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" /> Remove post
                  </button>
                  <button
                    onClick={() => navigate('/community')}
                    className="ml-auto flex items-center gap-1 text-[8.5px] text-primary-300/60 transition hover:text-primary-200"
                  >
                    View discussion <ArrowUpRight className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
        <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300/45" />
        <p className="text-[8.5px] leading-relaxed text-white/25">
          Removing a post is permanent for this demo. Every moderation action writes an audit-log entry visible on the admin overview.
        </p>
      </div>
    </div>
  );
}
