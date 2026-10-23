import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  ChevronRight,
  Clock,
  Code2,
  FileText,
  Loader2,
  Lock,
  MessageCircleQuestion,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  Presentation,
  Quote,
  Send,
  Sparkles,
  Timer,
  Trash2,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import LessonVideo from '../components/LessonVideo';
import ProgressRing from '../components/ProgressRing';
import { useToast } from '../components/Toast';
import { api, apiPost, apiPut, apiDelete, errorMessage } from '../lib/api';
import { formatTime } from '../lib/time';

type Note = {
  id: string;
  time: number;
  text: string;
};

type Lecture = {
  id: string;
  module_id: string;
  title: string;
  video_url: string;
  transcript: string;
  duration_seconds: number;
  order_index: number;
  resource_urls?: string[];
};

type Module = {
  id: string;
  title: string;
  order_index: number;
  lectures: Lecture[];
};

type CourseDetail = {
  course: {
    id: string;
    title: string;
    instructor_name: string;
    lessons_count: number;
    learner_count: number;
    enrolled: boolean;
    progress: number;
  };
  modules: Module[];
};

type Summary = {
  lecture_title: string;
  summary: string;
  key_points: string[];
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
};

const tabs = [
  { id: 'summary', label: 'AI Summary' },
  { id: 'notes', label: 'Notes' },
  { id: 'qa', label: 'Q&A' },
  { id: 'transcript', label: 'Transcript' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const speeds = [1, 1.2, 1.5, 2];

const isResourceLink = (resource: string) => /^https?:\/\//i.test(resource) || resource.startsWith('/');
const isDirectVideoUrl = (url: string) => /\.(mp4|webm)(\?.*)?$/i.test(url);

export default function Lesson() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const courseId = searchParams.get('course') || 'c-dsa';
  const lectureParam = searchParams.get('lecture');
  const [courseData, setCourseData] = useState<CourseDetail | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.2);
  const [tab, setTab] = useState<TabId>('summary');
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [hoursLearned, setHoursLearned] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const noteInputRef = useRef<HTMLInputElement>(null);
  const nativeVideoRef = useRef<HTMLVideoElement>(null);
  const timeRef = useRef(0);

  const duration = lecture?.duration_seconds || 2170;
  const lessonsTotal = courseData?.course.lessons_count || 22;
  const courseProgress = courseData?.course.progress || 0;
  const courseCompletedLessons = Math.round((lessonsTotal * courseProgress) / 100);
  const flatLectures = modules.flatMap((module) => module.lectures);
  const lessonIndex = lecture ? flatLectures.findIndex((item) => item.id === lecture.id) : -1;
  const currentModule = modules.find((module) => module.id === lecture?.module_id);
  const nextLecture = lessonIndex >= 0 ? flatLectures[lessonIndex + 1] : undefined;
  const previousLecture = lessonIndex > 0 ? flatLectures[lessonIndex - 1] : undefined;
  const transcriptSegments = buildTranscriptSegments(lecture?.transcript || '', duration);
  const timestampRows = transcriptSegments.slice(0, 3);
  const resources = lecture?.resource_urls || [];
  const directVideo = Boolean(lecture?.video_url && isDirectVideoUrl(lecture.video_url));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api<CourseDetail>(`/courses/${courseId}`)
      .then((data) => {
        if (cancelled) return;
        setCourseData(data);
        setModules(data.modules);
        const all = data.modules.flatMap((module) => module.lectures);
        const chosen = all.find((item) => item.id === lectureParam) || all.find((item) => item.id === 'l-dsa-12') || all[0];
        if (!chosen) {
          setError('This course has no lectures yet.');
          setLecture(null);
          return;
        }
        setLecture(chosen);
        setPlaying(false);
        setTime(0);
        setCompleted(false);
        setSummary(null);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, lectureParam]);

  useEffect(() => {
    api<{ stats: { completed_lessons: number; hours_learned: number } }>('/dashboard/me')
      .then((data) => {
        setHoursLearned(data.stats.hours_learned);
      })
      .catch(() => {
        // The lesson itself can still load if the dashboard summary is unavailable.
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ announcements: Announcement[] }>(`/courses/${courseId}/announcements`)
      .then((data) => {
        if (!cancelled) setAnnouncements(data.announcements || []);
      })
      .catch(() => {
        if (!cancelled) setAnnouncements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!lecture) return;
    let cancelled = false;
    setSummary(null);
    setSummaryLoading(true);
    api<{ notes: Array<{ id: string; timestamp_seconds: number; content: string }>; bookmark: { id: string } | null; progress: { watched_seconds: number; completed: number } }>(
      `/lectures/${lecture.id}/notes`,
    )
      .then((data) => {
        if (cancelled) return;
        setNotes(
          data.notes.map((note) => ({ id: note.id, time: Number(note.timestamp_seconds), text: note.content })),
        );
        setBookmarkId(data.bookmark?.id || null);
        setCompleted(Boolean(data.progress?.completed));
        if (Number(data.progress?.watched_seconds) > 0) {
          setTime(Math.min(lecture.duration_seconds, Number(data.progress.watched_seconds)));
        }
      })
      .catch((caught) => {
        if (!cancelled) showToast(errorMessage(caught));
      });
    apiPost<Summary>(`/ai/lectures/${lecture.id}/summarize`)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) {
          setSummary({
            lecture_title: lecture.title,
            summary: lecture.transcript,
            key_points: [],
          });
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lecture?.id]);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    if (!playing || directVideo) return;
    const timer = window.setInterval(() => {
      setTime((current) => Math.min(duration, current + 1));
    }, 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, duration, directVideo]);

  useEffect(() => {
    const video = nativeVideoRef.current;
    if (!video || !directVideo || playing) return;
    if (Math.abs(video.currentTime - time) > 1.5) video.currentTime = time;
  }, [directVideo, time, playing, lecture?.id]);

  useEffect(() => {
    if (duration > 0 && time >= duration) setPlaying(false);
  }, [time, duration]);

  useEffect(() => {
    if (!playing || !lecture) return;
    const saver = window.setInterval(() => {
      apiPost(`/lectures/${lecture.id}/progress`, {
        watched_seconds: Math.floor(timeRef.current),
        completed,
      }).catch(() => {
        // Progress is best-effort while playback is running.
      });
    }, 20_000);
    return () => window.clearInterval(saver);
  }, [playing, lecture?.id, completed]);

  const seek = (seconds: number) => {
    const next = Math.max(0, Math.min(duration, seconds));
    setTime(next);
    if (nativeVideoRef.current) nativeVideoRef.current.currentTime = next;
  };

  const cycleSpeed = () => {
    const index = speeds.indexOf(speed);
    const next = speeds[(index + 1) % speeds.length];
    setSpeed(next);
    showToast(`Playback speed set to ${next}x.`);
  };

  const jumpTo = (seconds: number) => {
    seek(seconds);
    setPlaying(true);
    showToast(`Jumped to ${formatTime(seconds)}.`);
  };

  const goToLecture = (target?: Lecture) => {
    if (!target) return;
    const next = new URLSearchParams(searchParams);
    next.set('course', courseId);
    next.set('lecture', target.id);
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleBookmark = async () => {
    if (!lecture) return;
    try {
      if (bookmarkId) {
        await apiDelete(`/bookmarks/${bookmarkId}`);
        setBookmarkId(null);
        showToast('Bookmark removed.');
      } else {
        const data = await apiPost<{ bookmark: { id: string } }>(`/lectures/${lecture.id}/bookmarks`, {
          timestamp_seconds: Math.floor(time),
        });
        setBookmarkId(data.bookmark.id);
        showToast(`Bookmark saved at ${formatTime(time)}.`);
      }
    } catch (caught) {
      showToast(errorMessage(caught));
    }
  };

  const focusNote = () => {
    setTab('notes');
    window.setTimeout(() => {
      noteInputRef.current?.focus();
      noteInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 90);
  };

  const addNote = async (event: FormEvent) => {
    event.preventDefault();
    const text = noteDraft.trim();
    if (!text || !lecture) return;
    try {
      const data = await apiPost<{ note: { id: string; timestamp_seconds: number; content: string } }>(
        `/lectures/${lecture.id}/notes`,
        { content: text, timestamp_seconds: Math.floor(time) },
      );
      setNotes((current) => [
        { id: data.note.id, time: Number(data.note.timestamp_seconds), text: data.note.content },
        ...current,
      ]);
      setNoteDraft('');
      showToast(`Note saved at ${formatTime(time)}.`);
    } catch (caught) {
      showToast(errorMessage(caught));
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await apiDelete(`/notes/${id}`);
      setNotes((current) => current.filter((note) => note.id !== id));
      showToast('Note deleted.');
    } catch (caught) {
      showToast(errorMessage(caught));
    }
  };

  const updateNote = async (id: string, text: string) => {
    try {
      await apiPut(`/notes/${id}`, { content: text });
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, text } : note)));
      showToast('Note updated.');
    } catch (caught) {
      showToast(errorMessage(caught));
    }
  };

  const toggleCompleted = async () => {
    if (!lecture) return;
    const next = !completed;
    try {
      const data = await apiPost<{
        progress: number;
        certificate?: { credential_id: string } | null;
        badges?: Array<{ name: string }>;
      }>(`/lectures/${lecture.id}/progress`, {
        watched_seconds: Math.floor(time),
        completed: next,
      });
      setCompleted(next);
      setCourseData((current) =>
        current ? { ...current, course: { ...current.course, progress: data.progress } } : current,
      );
      if (data.certificate) {
        showToast(`Course complete! Certificate ${data.certificate.credential_id} issued and emailed.`);
      } else if (data.badges?.length) {
        showToast(`Badge unlocked: ${data.badges.map((badge) => badge.name).join(', ')}.`);
      } else if (next) {
        showToast('Lesson marked complete · +40 XP earned.');
      } else {
        showToast('Lesson completion removed.');
      }
      showToast(next ? 'Lesson marked complete · +40 XP earned.' : 'Lesson completion removed.');
    } catch (caught) {
      showToast(errorMessage(caught));
    }
  };

  const refreshSummary = async () => {
    if (!lecture) return;
    setSummaryLoading(true);
    try {
      const data = await apiPost<Summary>(`/ai/lectures/${lecture.id}/summarize`);
      setSummary(data);
      showToast('Summary refreshed from the lecture transcript.');
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setSummaryLoading(false);
    }
  };

  const openResource = (resource: string) => {
    const isLink = /^https?:\/\//i.test(resource) || resource.startsWith('/');
    const label = resource.split('/').pop() || resource;
    if (isLink) {
      window.open(resource, '_blank', 'noopener,noreferrer');
      return;
    }
    showToast(`${label} · downloadable course material.`);
  };

  if (loading) {
    return (
      <div className="mx-auto grid min-h-[60vh] w-full max-w-[1440px] place-items-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary-300/60" />
          <p className="mt-3 text-[11px] text-white/35">Loading lesson and course material…</p>
        </div>
      </div>
    );
  }

  if (error || !lecture || !courseData) {
    return (
      <div className="mx-auto w-full max-w-[900px] px-4 py-16 text-center">
        <FileText className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-3 text-[14px] font-medium text-white/60">Lesson unavailable</p>
        <p className="mt-1 text-[10.5px] text-white/30">{error || 'This course does not have a lesson yet.'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-300/75">
            Module {currentModule?.order_index ?? 1} <span className="h-[3px] w-[3px] rounded-full bg-primary-400/40" />
            <span className="font-medium normal-case tracking-normal text-white/30">{currentModule?.title || courseData.course.title}</span>
          </p>
          <h1 className="mt-2 max-w-3xl font-display text-[25px] font-bold leading-[1.25] tracking-[-0.03em] text-white sm:text-[28px]">
            Lesson {lessonIndex + 1}: {lecture.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10.5px] text-white/30">
            <Avatar name={courseData.course.instructor_name} size={23} />
            <span className="font-medium text-white/55">{courseData.course.instructor_name}</span>
            <BadgeCheck className="h-3 w-3 text-sky-400" />
            <span>Verified instructor</span>
            <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatTime(duration)}
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
            <span>{courseData.course.learner_count.toLocaleString()} learners</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleBookmark}
            className={`btn-ghost h-9 px-3 text-[11px] ${bookmarkId ? 'border-primary-400/25 bg-primary-500/10 text-primary-200' : ''}`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${bookmarkId ? 'fill-primary-300 text-primary-300' : ''}`} />
            Bookmark <span className="font-mono text-[9px] text-white/25">{formatTime(time)}</span>
          </button>
          <button onClick={focusNote} className="btn-ghost h-9 px-3 text-[11px]">
            <Plus className="h-3.5 w-3.5" />
            Add note
          </button>
          <button
            onClick={() =>
              resources[0]
                ? openResource(resources[0])
                : showToast('No downloadable slides attached to this lesson.')
            }
            className="btn-ghost h-9 px-3 text-[11px]"
          >
            <Presentation className="h-3.5 w-3.5" />
            Slides
          </button>
        </div>
      </header>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_356px]">
        <div className="min-w-0">
          {directVideo && lecture?.video_url ? (
            <div className="video-shell relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07050d] shadow-[0_24px_60px_-40px_rgba(0,0,0,1)]">
              <video
                ref={nativeVideoRef}
                src={lecture.video_url}
                controls
                playsInline
                preload="metadata"
                className="aspect-[16/9] w-full bg-black"
                onLoadedMetadata={(event) => {
                  event.currentTarget.currentTime = Math.min(duration, time);
                }}
                onTimeUpdate={(event) => setTime(Math.min(duration, event.currentTarget.currentTime))}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onRateChange={(event) => setSpeed(event.currentTarget.playbackRate)}
              />
            </div>
          ) : (
            <LessonVideo
              time={time}
              duration={duration}
              playing={playing}
              speed={speed}
              onTogglePlay={() => setPlaying((current) => !current)}
              onSeek={seek}
              onSpeedChange={cycleSpeed}
            />
          )}

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
            <div className="flex items-end gap-1 border-b border-white/[0.055] px-5 pt-2">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`relative px-3 py-3 text-[11.5px] font-medium transition ${
                    tab === item.id ? 'text-primary-200' : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {item.id === 'notes' ? `Notes (${notes.length})` : item.label}
                  {tab === item.id && (
                    <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-primary-400 to-teal2" />
                  )}
                </button>
              ))}
              <span className="ml-auto hidden items-center gap-1.5 pb-3 text-[9px] text-white/20 sm:flex">
                <Sparkles className="h-3 w-3 text-primary-300/50" />
                AI-generated from lecture transcript
              </span>
            </div>

            <div className="p-4 sm:p-5">
              {tab === 'summary' && (
                <SummaryPanel
                  summary={summary}
                  loading={summaryLoading}
                  onRegenerate={refreshSummary}
                />
              )}
              {tab === 'notes' && (
                <Notebook
                  notes={notes}
                  time={time}
                  draft={noteDraft}
                  setDraft={setNoteDraft}
                  inputRef={noteInputRef}
                  onAdd={addNote}
                  onDelete={deleteNote}
                  onUpdate={updateNote}
                />
              )}
              {tab === 'qa' && (
                <QaPanel courseId={courseId} lectureId={lecture.id} lectureTitle={lecture.title} />
              )}
              {tab === 'transcript' && <TranscriptPanel transcript={lecture.transcript} duration={duration} onJump={jumpTo} />}
            </div>
          </div>

          <div className="mt-4 flex gap-2.5">
            <button
              onClick={() => goToLecture(previousLecture)}
              disabled={!previousLecture}
              className="btn-ghost h-10 flex-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Previous lesson
            </button>
            <button
              onClick={() => goToLecture(nextLecture)}
              disabled={!nextLecture}
              className="btn-primary h-10 flex-[1.2] text-[11px] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Next lesson
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Lesson progress</h2>
              <span className="font-mono text-[8.5px] text-white/25">{courseCompletedLessons} / {lessonsTotal}</span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <ProgressRing value={courseProgress} size={62} stroke={5} caption="Course" />
              <div className="space-y-1.5 text-[10px]">
                <p className="font-medium text-white/60">{courseCompletedLessons} of {lessonsTotal} lessons complete</p>
                <p className="text-white/25">{hoursLearned ? `${hoursLearned.toFixed(1)}h` : '0h'} watched across your courses</p>
                <p className="flex items-center gap-1 text-teal-300/65">
                  <Timer className="h-3 w-3" /> {formatTime(Math.max(0, duration - time))} remaining in this lesson
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-white/25">Current lesson</span>
                <span className="font-mono text-white/40">{formatTime(time)} / {formatTime(duration)}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-teal2" style={{ width: `${(time / duration) * 100}%` }} />
              </div>
            </div>

            <button
              onClick={toggleCompleted}
              className={`mt-3.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-[10px] font-medium transition ${
                completed
                  ? 'border-emerald-400/25 bg-emerald-400/[0.1] text-emerald-200'
                  : 'border-teal2/15 bg-teal2/[0.06] text-teal-200/80 hover:bg-teal2/[0.1]'
              }`}
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {completed ? 'Lesson completed' : 'Mark lesson complete'}
            </button>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Interactive timestamps</h2>
              <span className="text-[8.5px] text-white/20">Jump to</span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {timestampRows.map((row, index) => (
                <TimestampRow
                  key={`${row.seconds}-${index}`}
                  timeLabel={formatTime(row.seconds)}
                  title={row.text}
                  onClick={() => jumpTo(row.seconds)}
                  active={Math.abs(time - row.seconds) < 30}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <h2 className="font-display text-[13px] font-semibold text-white/90">Lesson resources</h2>
            <div className="mt-2.5 space-y-1.5">
              {resources.map((resource) => {
                const Icon = resource.toLowerCase().endsWith('.py') || resource.toLowerCase().endsWith('.js') ? Code2 : resource.toLowerCase().endsWith('.pdf') ? FileText : Presentation;
                const label = resource.split('/').pop() || resource;
                return (
                  <ResourceRow
                    key={resource}
                    icon={Icon}
                    label={label}
                    meta={resource.toLowerCase().endsWith('.pdf') ? 'Slides · PDF' : resource.toLowerCase().endsWith('.py') ? 'Starter code · Python' : isResourceLink(resource) ? 'Download or preview' : 'Resource'}
                    onClick={() => openResource(resource)}
                  />
                );
              })}
              <ResourceRow icon={FileText} label="Full transcript" meta="Grounded course material" onClick={() => setTab('transcript')} />
            </div>
          </section>

          {announcements.length > 0 && (
            <section className="rounded-2xl border border-primary-400/15 bg-gradient-to-br from-[#1a1230] to-[#100d19] p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-[13px] font-semibold text-white/90">Course announcements</h2>
                <span className="rounded-full border border-primary-400/15 bg-primary-500/[0.08] px-2 py-0.5 text-[8px] font-semibold text-primary-200">{announcements.length}</span>
              </div>
              <div className="mt-2.5 max-h-[240px] space-y-2 overflow-y-auto pr-1">
                {announcements.map((item) => (
                  <article key={item.id} className="rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-2.5">
                    <p className="text-[10.5px] font-medium text-white/75">{item.title}</p>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-white/35">{item.content}</p>
                    <p className="mt-1.5 text-[8px] text-white/22">{item.author_name} · {new Date(item.created_at).toLocaleDateString()}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {nextLecture && (
            <button
              onClick={() => goToLecture(nextLecture)}
              className="group w-full rounded-2xl border border-primary-400/15 bg-gradient-to-br from-[#1c1335] to-[#100d19] p-4 text-left transition hover:border-primary-400/30"
            >
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-primary-300/60">Up next</p>
                <ArrowRight className="h-3.5 w-3.5 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-primary-200" />
              </div>
              <p className="mt-1.5 text-[11px] font-semibold leading-snug text-white/75">Lesson {lessonIndex + 2}: {nextLecture.title}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[8.5px] text-white/25">
                <Clock className="h-2.5 w-2.5" /> {formatTime(nextLecture.duration_seconds)}
                <span className="h-[2px] w-[2px] rounded-full bg-white/15" />
                {courseData.course.title}
              </div>
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function SummaryPanel({ summary, loading, onRegenerate }: { summary: Summary | null; loading: boolean; onRegenerate: () => void }) {
  const tones = [
    'border-teal2/20 bg-teal2/10 text-teal-300',
    'border-primary-400/20 bg-primary-500/10 text-primary-200',
    'border-amber-400/20 bg-amber-400/10 text-amber-300',
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-primary-300/15 bg-gradient-to-br from-primary-500/25 to-teal2/[0.05]">
            <Sparkles className="h-3.5 w-3.5 text-primary-200" />
          </span>
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-primary-300/75">AI Summary</p>
            <p className="mt-0.5 text-[11.5px] font-semibold leading-none text-white/80">Key takeaways</p>
          </div>
        </div>
        <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 font-mono text-[8px] text-white/25">
          {summary?.lecture_title ? 'Grounded in this lecture' : 'Reading transcript…'}
        </span>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-8 text-[10.5px] text-white/30">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating a grounded summary…
        </div>
      ) : summary ? (
        <>
          <p className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3.5 text-[10.5px] leading-[1.75] text-white/45">
            {summary.summary}
          </p>
          {summary.key_points.length > 0 && (
            <div className="mt-3 grid gap-2.5 md:grid-cols-3">
              {summary.key_points.slice(0, 3).map((point, index) => (
                <Takeaway key={point} n={index + 1} tone={tones[index % tones.length]} title={`Takeaway ${index + 1}`}>
                  {point}
                </Takeaway>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3.5 text-[10.5px] leading-[1.75] text-white/35">
          Summary is not available for this lecture yet. Try regenerating it from the transcript.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
        <p className="flex items-center gap-1.5 text-[9px] text-white/20">
          <Sparkles className="h-3 w-3 text-primary-300/40" />
          Generated from the lecture transcript · grounded in course material
        </p>
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="ml-auto text-[9px] font-medium text-primary-300/70 transition hover:text-primary-200 disabled:opacity-40"
        >
          Regenerate summary
        </button>
      </div>
    </div>
  );
}

function Takeaway({
  n,
  tone,
  title,
  children,
}: {
  n: number;
  tone: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3.5">
      <span className={`grid h-6 w-6 place-items-center rounded-full border font-mono text-[9px] font-semibold ${tone}`}>
        {n}
      </span>
      <p className="mt-2 text-[11.5px] font-semibold text-white/80">{title}</p>
      <p className="mt-1 text-[10.5px] leading-[1.7] text-white/35">{children}</p>
    </div>
  );
}

function TimestampRow({
  timeLabel,
  title,
  onClick,
  active = false,
}: {
  timeLabel: string;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
        active
          ? 'border-primary-400/20 bg-primary-500/[0.07]'
          : 'border-white/[0.05] bg-white/[0.015] hover:border-primary-400/15 hover:bg-white/[0.03]'
      }`}
    >
      <span className="flex items-center gap-1 rounded border border-primary-400/15 bg-primary-500/10 px-1.5 py-1 font-mono text-[8px] font-medium text-primary-200">
        <Play className="h-2 w-2 fill-primary-300 text-primary-300" />
        {timeLabel}
      </span>
      <span className={`flex-1 truncate text-[9.5px] ${active ? 'text-white/65' : 'text-white/40'} transition group-hover:text-white/75`}>
        {title}
      </span>
      <ChevronRight className="h-3 w-3 text-white/15" />
    </button>
  );
}

function ResourceRow({
  icon: Icon,
  label,
  meta,
  onClick,
}: {
  icon: typeof Presentation;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.015] px-2.5 py-2 text-left transition hover:border-white/[0.1] hover:bg-white/[0.03]"
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.04] text-white/35 group-hover:text-white/60">
        <Icon className="h-3 w-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[9.5px] font-medium text-white/55 group-hover:text-white/80">{label}</span>
        <span className="mt-0.5 block text-[8px] text-white/20">{meta}</span>
      </span>
      <ChevronRight className="h-2.5 w-2.5 text-white/15" />
    </button>
  );
}

function Notebook({
  notes,
  time,
  draft,
  setDraft,
  inputRef,
  onAdd,
  onDelete,
  onUpdate,
  className = '',
}: {
  notes: Note[];
  time: number;
  draft: string;
  setDraft: (value: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  onAdd: (event: FormEvent) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
  className?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const startEditing = (note: Note) => {
    setEditingId(note.id);
    setEditDraft(note.text);
  };

  const saveEditing = () => {
    const text = editDraft.trim();
    if (!editingId || !text) return;
    onUpdate(editingId, text);
    setEditingId(null);
    setEditDraft('');
  };

  return (
    <section className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary-300/80" />
          <h3 className="font-display text-[13px] font-semibold text-white/90">Your notebook</h3>
          <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[8px] text-white/25">
            {notes.length} notes
          </span>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[8px] text-white/25">
          <Lock className="h-2.5 w-2.5" />
          Private
        </span>
      </div>

      <div className="mt-3 grid gap-2.5 md:grid-cols-2">
        {notes.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center text-[10.5px] text-white/25">
            No notes yet. Capture an “aha” moment below.
          </p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition hover:border-white/[0.1]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8.5px] text-primary-300/70">{formatTime(note.time)}</span>
              <div className="flex items-center gap-1 opacity-40 transition group-hover:opacity-100">
                <button
                  onClick={() => startEditing(note)}
                  className="grid h-5 w-5 place-items-center rounded text-white/30 hover:text-white/70"
                  aria-label="Edit note"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                <button
                  onClick={() => onDelete(note.id)}
                  className="grid h-5 w-5 place-items-center rounded text-white/30 hover:text-rose-300"
                  aria-label="Delete note"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
            {editingId === note.id ? (
              <div className="mt-2">
                <textarea
                  autoFocus
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                  rows={3}
                  aria-label="Edit note text"
                  className="w-full resize-none rounded-lg border border-primary-400/30 bg-[#0d0b14] px-2.5 py-2 text-[10.5px] leading-[1.7] text-white/70 focus:outline-none"
                />
                <div className="mt-1.5 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditDraft('');
                    }}
                    className="rounded-md px-2 py-1 text-[8.5px] font-medium text-white/30 transition hover:text-white/60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditing}
                    disabled={!editDraft.trim()}
                    className="rounded-md border border-primary-400/20 bg-primary-500/10 px-2 py-1 text-[8.5px] font-medium text-primary-200 transition hover:bg-primary-500/20 disabled:opacity-30"
                  >
                    Save note
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[10.5px] leading-[1.7] text-white/50">{note.text}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[9px] text-white/25">
          Add note at current frame: <span className="font-mono text-primary-300/70">{formatTime(time)}</span>
        </p>
        <span className="text-[8px] text-white/15">Auto-saved</span>
      </div>

      <form
        onSubmit={onAdd}
        className="mt-2 flex max-w-2xl items-center gap-2 rounded-xl border border-white/[0.075] bg-[#12101b] py-1.5 pl-3 pr-2 transition focus-within:border-primary-400/35"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Take key insights, questions or edge cases..."
          aria-label="New note"
          className="h-8 min-w-0 flex-1 bg-transparent text-[11px] text-white/75 placeholder:text-white/20 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-rose2 via-primary-500 to-primary-400 text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-30"
          aria-label="Save note"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </section>
  );
}

function QaPanel({ courseId, lectureId, lectureTitle }: { courseId: string; lectureId: string; lectureTitle: string }) {
  const { showToast } = useToast();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ content: string; sources: Array<{ lecture_id: string; lecture_title: string; timestamp_seconds: number; snippet: string }> } | null>(null);
  const [asking, setAsking] = useState(false);

  const ask = async (raw?: string) => {
    const text = (raw ?? question).trim();
    if (!text || asking) return;
    setAsking(true);
    try {
      const data = await apiPost<{
        message: {
          content: string;
          sources: Array<{ lecture_id: string; lecture_title: string; timestamp_seconds: number; snippet: string }>;
        };
      }>('/ai/chat', {
        course_id: courseId,
        message: `About the lecture "${lectureTitle}" (${lectureId}): ${text}`,
        mode: 'intermediate',
      });
      setAnswer({ content: data.message.content, sources: data.message.sources || [] });
      setQuestion('');
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-primary-400/15 bg-primary-500/10">
            <MessageCircleQuestion className="h-3.5 w-3.5 text-primary-200" />
          </span>
          <div>
            <p className="text-[10.5px] font-medium text-white/65">Ask this lecture</p>
            <p className="mt-0.5 text-[8.5px] text-white/25">Answers are grounded in the transcript and cite their source.</p>
          </div>
          <span className="ml-auto flex items-center gap-1 rounded-full border border-teal2/15 bg-teal2/[0.05] px-2 py-1 text-[8px] text-teal-300/60">
            <Sparkles className="h-2.5 w-2.5" /> AI + transcript
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Why does this concept matter?', 'Show a worked example', 'What is the common mistake?'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => ask(suggestion)}
              disabled={asking}
              className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[8.5px] text-white/35 transition hover:border-primary-400/20 hover:text-white/65 disabled:opacity-40"
            >
              {suggestion}
            </button>
          ))}
        </div>
        {answer && (
          <div className="mt-3 rounded-lg border border-primary-400/10 bg-primary-500/[0.05] p-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary-200" />
              <span className="text-[9px] font-semibold text-primary-200">Vertexon AI Tutor</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-[10.5px] leading-[1.75] text-white/45">{answer.content}</p>
            {answer.sources.length > 0 && (
              <p className="mt-2 truncate text-[8px] text-white/25">
                Source · {answer.sources[0].lecture_title} · {formatTime(answer.sources[0].timestamp_seconds)}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.075] bg-[#12101b] py-1.5 pl-3 pr-2 transition focus-within:border-primary-400/35">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') ask();
          }}
          placeholder="Ask a question about this lesson..."
          aria-label="Ask a question about this lesson"
          className="h-8 min-w-0 flex-1 bg-transparent text-[10.5px] text-white/75 placeholder:text-white/20 focus:outline-none"
        />
        <button
          onClick={() => ask()}
          disabled={!question.trim() || asking}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-400 text-white transition hover:brightness-110 disabled:opacity-30"
          aria-label="Ask question"
        >
          {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function TranscriptPanel({ transcript, duration, onJump }: { transcript: string; duration: number; onJump: (seconds: number) => void }) {
  const lines = buildTranscriptSegments(transcript, duration);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-teal-300/70" />
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/40">Auto transcript</p>
        </div>
        <span className="flex items-center gap-1 text-[8px] text-teal-300/50">
          <Sparkles className="h-2.5 w-2.5" /> grounded course material
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <button key={`${line.seconds}-${index}`} onClick={() => onJump(line.seconds)} className="group flex w-full gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.02]">
            <span className="mt-0.5 shrink-0 font-mono text-[8.5px] text-primary-300/50 group-hover:text-primary-200">
              {formatTime(line.seconds)}
            </span>
            <span className="text-[10.5px] leading-[1.75] text-white/40 group-hover:text-white/65">{line.text}</span>
          </button>
        ))}
        {lines.length === 0 && <p className="py-8 text-center text-[10px] text-white/25">No transcript has been indexed for this lecture.</p>}
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] p-2.5">
        <Quote className="h-3 w-3 shrink-0 text-primary-300/30" />
        <p className="text-[8.5px] leading-relaxed text-white/25">
          Transcript is grounded against the course glossary and used by the AI tutor for citations.
        </p>
      </div>
    </div>
  );
}

function buildTranscriptSegments(transcript: string, duration: number) {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (!sentences.length) return [];
  const step = duration / Math.max(1, sentences.length);
  return sentences.map((text, index) => ({ seconds: Math.round(index * step), text }));
}
