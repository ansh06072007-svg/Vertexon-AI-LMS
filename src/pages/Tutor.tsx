import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Database,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  Mic,
  PlayCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import QuicksortAnswer from '../components/QuicksortAnswer';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, apiPost, errorMessage } from '../lib/api';

type Mode = 'Beginner' | 'Intermediate' | 'Advanced';

type Source = {
  lecture_id: string;
  lecture_title: string;
  timestamp_seconds: number;
  snippet: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'ai';
  kind?: 'quicksort' | 'pivot' | 'text';
  text?: string;
  sources?: Source[];
};

type CourseOption = {
  id: string;
  title: string;
  enrolled: boolean;
  progress: number;
};

type Lecture = { id: string; title: string; duration_seconds: number; order_index: number };
type Module = { id: string; title: string; order_index: number; lectures: Lecture[] };
type CourseDetail = { course: { id: string; title: string }; modules: Module[] };
type Mastery = {
  id: string;
  topic: string;
  mastery: number;
  attempts_count: number;
  status: 'strong' | 'developing' | 'needs_review';
};

const modes: Mode[] = ['Beginner', 'Intermediate', 'Advanced'];

const initialMessages: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    text: 'Why does Quicksort degrade to O(n²) time complexity on already sorted input?',
  },
  { id: 'm2', role: 'ai', kind: 'quicksort' },
  { id: 'm3', role: 'user', text: 'How does randomized pivot fix this?' },
  { id: 'm4', role: 'ai', kind: 'pivot' },
];

const workflowActions = [
  { label: 'Summarize lecture', description: 'Key takeaways with timestamps', icon: FileText, action: 'summary' },
  { label: 'Auto-generate quiz', description: '5 grounded questions', icon: ListChecks, action: 'quiz' },
  { label: 'Create flashcards', description: 'Spaced-repetition deck', icon: Layers, action: 'flashcards' },
  { label: 'Build study plan', description: 'From your quiz history', icon: CalendarDays, action: 'plan' },
] as const;

const fallbackSources = [
  {
    id: 's1',
    title: 'Module 3 · Sorting & Searching',
    meta: 'Transcript chunks indexed',
    icon: PlayCircle,
    tone: 'bg-teal2/10 text-teal-300',
  },
  {
    id: 's2',
    title: 'Course notes · complexity analysis',
    meta: 'Grounded reference',
    icon: FileText,
    tone: 'bg-primary-500/10 text-primary-300',
  },
  {
    id: 's3',
    title: 'Quiz history · recent attempts',
    meta: 'Personalised context',
    icon: Database,
    tone: 'bg-sky-400/10 text-sky-300',
  },
];

const suggestions = ['Explain like I’m a beginner', 'Show a worked example', 'Quiz me on this topic'];

const formatTimestamp = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

export default function Tutor() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('Intermediate');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState('c-dsa');
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [courseMenu, setCourseMenu] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState<string | null>(null);
  const [mastery, setMastery] = useState<Mastery[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);

  useEffect(() => {
    api<{ courses: CourseOption[] }>('/courses?limit=50')
      .then((data) => {
        setCourses(data.courses);
        if (!data.courses.some((course) => course.id === courseId) && data.courses[0]) {
          setCourseId(data.courses[0].id);
        }
      })
      .catch((caught) => showToast(errorMessage(caught)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<CourseDetail>(`/courses/${courseId}`)
      .then((data) => {
        if (!cancelled) setCourseDetail(data);
      })
      .catch((caught) => {
        if (!cancelled) showToast(errorMessage(caught));
      });
    api<{ mastery: Mastery[] }>(`/mastery/me?course_id=${courseId}`)
      .then((data) => {
        if (!cancelled) setMastery(data.mastery || []);
      })
      .catch(() => {
        if (!cancelled) setMastery([]);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !hasInteracted.current) return;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const latestSourceMessage = [...messages].reverse().find((message) => message.role === 'ai' && message.sources?.length);
  const displaySources = latestSourceMessage?.sources?.length
    ? latestSourceMessage.sources.slice(0, 3).map((source, index) => ({
        id: source.lecture_id || `source-${index}`,
        title: source.lecture_title || 'Course material',
        meta: `${formatTimestamp(source.timestamp_seconds)} · ${source.snippet.slice(0, 52)}…`,
        icon: PlayCircle,
        tone: index === 0 ? 'bg-teal2/10 text-teal-300' : 'bg-primary-500/10 text-primary-300',
      }))
    : fallbackSources;

  const courseTitle = courseDetail?.course.title || courses.find((course) => course.id === courseId)?.title || 'Course material';
  const moduleTitle = courseDetail?.modules[0]?.title || 'Course overview';
  const lectureCount = courseDetail?.modules.reduce((sum, module) => sum + module.lectures.length, 0) || 0;

  const welcome = (title = courseTitle) => [
    {
      id: 'welcome',
      role: 'ai' as const,
      kind: 'text' as const,
      text: `I’m grounded in ${title}. Ask me about a concept, a worked example, or where you got stuck — and I’ll cite the exact lecture passage that supports the answer.`,
      sources: [] as Source[],
    },
  ];

  const sendText = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    if (typing) {
      showToast('Vertexon is still responding — give it a moment.');
      return;
    }

    hasInteracted.current = true;
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'user', text }]);
    setDraft('');
    setTyping(true);

    try {
      const data = await apiPost<{
        session: { id: string };
        message: { content: string; sources: Source[] };
      }>('/ai/chat', {
        course_id: courseId,
        message: text,
        mode: mode.toLowerCase(),
        session_id: sessionId,
      });
      setSessionId(data.session.id);
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'ai',
          kind: 'text',
          text: data.message.content,
          sources: data.message.sources || [],
        },
      ]);
    } catch (caught) {
      const message = errorMessage(caught);
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'ai',
          kind: 'text',
          text: `I couldn’t reach the tutor service. ${message}`,
        },
      ]);
      showToast(message);
    } finally {
      setTyping(false);
    }
  };

  const sendMessage = () => sendText(draft);

  const switchMode = (next: Mode) => {
    setMode(next);
    showToast(`Explanation depth set to ${next.toLowerCase()}.`);
  };

  const appendAi = (text: string, sources: Source[] = []) => {
    hasInteracted.current = true;
    setMessages((current) => [
      ...current,
      { id: `a-tool-${Date.now()}`, role: 'ai', kind: 'text', text, sources },
    ]);
  };

  const runWorkflow = async (action: (typeof workflowActions)[number]['action']) => {
    if (action === 'quiz') {
      navigate('/quiz');
      return;
    }
    if (action === 'summary') {
      const lecture = courseDetail?.modules.flatMap((module) => module.lectures)[0];
      if (!lecture) {
        showToast('Add a lecture to this course first.');
        return;
      }
      setWorkflowBusy(action);
      try {
        const data = await apiPost<{ summary: string; key_points: string[]; sources: Source[]; lecture_title: string }>(
          `/ai/lectures/${lecture.id}/summarize`,
        );
        appendAi(
          `Summary · ${data.lecture_title}\n\n${data.summary}\n\nKey points:\n${data.key_points
            .map((point) => `• ${point}`)
            .join('\n')}`,
          data.sources,
        );
        showToast('Lecture summary generated from indexed material.');
      } catch (caught) {
        showToast(errorMessage(caught));
      } finally {
        setWorkflowBusy(null);
      }
      return;
    }
    if (action === 'flashcards') {
      const module = courseDetail?.modules[0];
      if (!module) {
        showToast('No module available for flashcards.');
        return;
      }
      setWorkflowBusy(action);
      try {
        const data = await apiPost<{ flashcards: Array<{ question: string; answer: string }> }>(
          `/ai/modules/${module.id}/flashcards`,
        );
        appendAi(
          `Flashcards · ${module.title}\n\n${data.flashcards
            .slice(0, 4)
            .map((card, index) => `${index + 1}. ${card.question}\n${card.answer}`)
            .join('\n\n')}`,
        );
        showToast(`${data.flashcards.length} flashcards generated.`);
      } catch (caught) {
        showToast(errorMessage(caught));
      } finally {
        setWorkflowBusy(null);
      }
      return;
    }
    setWorkflowBusy(action);
    try {
      const data = await apiPost<{ plan: { focus: string; blocks: Array<{ label: string; minutes: number }> } }>(
        '/ai/study-plan',
        { course_id: courseId },
      );
      appendAi(
        `Study plan · ${courseTitle}\n\nFocus: ${data.plan.focus}\n\n${data.plan.blocks
          .map((block) => `• ${block.label} · ${block.minutes} min`)
          .join('\n')}`,
      );
      showToast('Study plan generated from your progress and quiz history.');
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setWorkflowBusy(null);
    }
  };

  const resetSession = () => {
    setMessages(welcome());
    setDraft('');
    setTyping(false);
    setSessionId(null);
    hasInteracted.current = false;
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('New tutor session started.');
  };

  const selectCourse = (course: CourseOption) => {
    setCourseId(course.id);
    setCourseMenu(false);
    setSessionId(null);
    setMessages(welcome(course.title));
    showToast(`Tutor context switched to ${course.title}.`);
  };

  const openSource = (id: string) => {
    if (id.startsWith('source-') || id.startsWith('lecture') || id.startsWith('l-')) {
      navigate(`/lesson?course=${courseId}`);
    } else {
      showToast('Source explorer opened · indexed course material.');
    }
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col px-4 pb-6 pt-6 sm:px-6 lg:px-8 xl:h-[calc(100dvh-70px)] xl:min-h-0">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-300/75">
            <Sparkles className="h-3.5 w-3.5" />
            Course-grounded AI
            <span className="flex items-center gap-1.5 rounded-full border border-teal2/15 bg-teal2/[0.06] px-2 py-[3px] text-[8px] font-medium normal-case tracking-normal text-teal-300/80">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-teal2" />
              RAG live
            </span>
          </div>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[31px]">
            Ask anything. Understand faster.
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/35">
            Answers stay grounded in your course material, with citations from the exact lecture or PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={resetSession} className="btn-ghost h-10 px-3.5 text-[11.5px]">
            <RotateCcw className="h-3.5 w-3.5" />
            New session
          </button>
          <button
            onClick={() => showToast('Study plan refreshed · 7-day plan generated from your quiz history.')}
            className="btn-primary h-10 px-4 text-[11.5px]"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Study plan
          </button>
        </div>
      </header>

      <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-white/[0.065] bg-[#100d19] px-3.5 py-2.5 lg:flex-row lg:items-center">
        <div className="relative min-w-0">
          <button
            onClick={() => setCourseMenu((current) => !current)}
            className="group flex min-w-0 items-center gap-2.5 text-left"
            aria-expanded={courseMenu}
            aria-haspopup="listbox"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary-400/15 bg-primary-500/10">
              <GraduationCap className="h-4 w-4 text-primary-200" />
            </span>
            <span className="min-w-0">
              <span className="block max-w-[300px] truncate text-[9px] font-bold uppercase tracking-[0.14em] text-primary-300/70">
                {courseTitle}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] font-medium text-white/65 transition group-hover:text-white/85">
                {moduleTitle}
              </span>
            </span>
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/25 transition ${courseMenu ? 'rotate-180' : ''}`} />
          </button>
          {courseMenu && (
            <div className="absolute left-0 top-12 z-30 w-[320px] overflow-hidden rounded-xl border border-white/[0.09] bg-[#100d19] p-1.5 shadow-2xl" role="listbox">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => selectCourse(course)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                    courseId === course.id ? 'bg-primary-500/[0.12] text-primary-100' : 'text-white/45 hover:bg-white/[0.035] hover:text-white/75'
                  }`}
                  role="option"
                  aria-selected={courseId === course.id}
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-white/25" />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-medium">{course.title}</span>
                  <span className="shrink-0 text-[7px] uppercase tracking-wide text-white/20">{course.enrolled ? 'enrolled' : 'view'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-[10px] font-medium text-white/25 sm:block">Explanation depth</span>
          <div className="flex rounded-full border border-white/[0.06] bg-[#0b0912] p-[3px]" aria-label="Explanation mode">
            {modes.map((item) => (
              <button
                key={item}
                onClick={() => switchMode(item)}
                className={`rounded-full px-3.5 py-1.5 text-[10.5px] font-medium transition-all ${
                  mode === item
                    ? 'bg-gradient-to-r from-primary-600 to-primary-400 text-white shadow-[0_4px_14px_-6px_rgba(139,92,246,0.9)]'
                    : 'text-white/30 hover:text-white/65'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_356px]">
        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-white/[0.065] bg-[#0b0912] xl:min-h-0">
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.055] px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-400 via-primary-500 to-teal2/80 shadow-[0_0_22px_-5px_rgba(139,92,246,0.9)]">
                <Sparkles className="h-4 w-4 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0912] bg-emerald-400" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[12.5px] font-semibold text-white/90">Vertexon AI Tutor</p>
                  <span className="rounded border border-primary-400/15 bg-primary-500/[0.07] px-1.5 py-[1px] text-[7.5px] font-semibold uppercase tracking-[0.1em] text-primary-300/70">
                    Guided
                  </span>
                </div>
                <p className="mt-0.5 text-[9.5px] text-white/30">Course-grounded teaching assistant · citations included</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[8.5px] text-white/30 sm:flex">
                <Database className="h-3 w-3 text-teal-300/60" />
                {lectureCount ? `${lectureCount * 3} sources indexed` : 'Indexing course…'}
              </span>
              <Avatar name={user?.full_name || 'Ananya Sharma'} size={30} online />
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 lg:px-6">
            {messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="flex animate-fade-up justify-end">
                  <div className="max-w-[82%] rounded-2xl rounded-br-md border border-primary-300/20 bg-gradient-to-br from-primary-600/80 to-primary-500/60 px-4 py-3 text-[12.5px] leading-[1.7] text-white/90 shadow-[0_10px_28px_-18px_rgba(139,92,246,0.95)] sm:max-w-[70%]">
                    {message.text}
                  </div>
                </div>
              ) : (
                <div key={message.id}>
                  {message.kind === 'quicksort' && <QuicksortAnswer />}
                  {message.kind === 'pivot' && <PivotAnswer onOpen={() => navigate('/lesson')} />}
                  {message.kind === 'text' && <TextAnswer text={message.text ?? ''} sources={message.sources} />}
                </div>
              ),
            )}
            {typing && <TypingIndicator />}
          </div>

          <div className="shrink-0 border-t border-white/[0.055] bg-[#09070f]/95 px-4 pb-3.5 pt-3 lg:px-5">
            <div className="no-scrollbar mb-2.5 flex gap-1.5 overflow-x-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    if (suggestion.startsWith('Quiz')) navigate('/quiz');
                    else sendText(suggestion);
                  }}
                  className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[9.5px] text-white/35 transition hover:border-primary-400/20 hover:text-white/65"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#12101b] py-1.5 pl-3.5 pr-2 transition focus-within:border-primary-400/40 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.05)]">
              <Sparkles className="h-4 w-4 shrink-0 text-primary-300/70" />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendMessage();
                }}
                placeholder="Ask AI Tutor anything from this module..."
                aria-label="Ask the AI tutor"
                className="h-9 min-w-0 flex-1 bg-transparent text-[12.5px] text-white/80 placeholder:text-white/20 focus:outline-none"
              />
              {draft.trim() ? (
                <button
                  onClick={sendMessage}
                  disabled={typing}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-400 text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => showToast('Voice input · listening is coming soon.')}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/35 transition hover:text-white/70"
                  aria-label="Voice input"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 px-0.5 text-[8px] text-white/20">
              <span>
                Context memory <span className="text-white/35">7.8K / 12K tokens</span>
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5 text-teal-300/50" />
                Privacy first · conversations stay scoped to this course
              </span>
            </div>
          </div>
        </section>

        <aside className="min-h-0 space-y-4 xl:overflow-y-auto">
          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Tutor workflow</h2>
              <Wand2 className="h-3.5 w-3.5 text-primary-300/50" />
            </div>
            <p className="mt-0.5 text-[9.5px] text-white/25">One-click actions grounded in {moduleTitle}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {workflowActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => runWorkflow(action.action)}
                    disabled={workflowBusy !== null}
                    className="group rounded-xl border border-white/[0.055] bg-white/[0.018] p-2.5 text-left transition hover:border-primary-400/20 hover:bg-white/[0.035] disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-6 w-6 place-items-center rounded-md border border-primary-400/15 bg-primary-500/[0.08] text-primary-200">
                        <Icon className="h-3 w-3" />
                      </span>
                      <ArrowUpRight className="h-2.5 w-2.5 text-white/15 transition group-hover:text-white/40" />
                    </div>
                    <p className="mt-2 text-[10px] font-semibold leading-tight text-white/65 transition group-hover:text-white/90">
                      {action.label}
                    </p>
                    <p className="mt-0.5 text-[8px] leading-tight text-white/25">{action.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Session context</h2>
              <span className="flex items-center gap-1 text-[8px] text-teal-300/60">
                <span className="h-1 w-1 animate-pulse-soft rounded-full bg-teal2" /> Synced
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-white/20" />
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] uppercase tracking-[0.1em] text-white/20">Course</p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-white/60">{courseTitle}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Layers className="mt-0.5 h-3 w-3 shrink-0 text-white/20" />
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] uppercase tracking-[0.1em] text-white/20">Module</p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-white/60">{moduleTitle}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Database className="mt-0.5 h-3 w-3 shrink-0 text-white/20" />
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] uppercase tracking-[0.1em] text-white/20">Indexed material</p>
                  <p className="mt-0.5 text-[10px] font-medium text-white/60">{lectureCount || 0} lectures · transcript chunks indexed</p>
                </div>
              </div>
            </div>

            <div className="mt-3.5 border-t border-white/[0.05] pt-3">
              <div className="flex items-center justify-between text-[8.5px]">
                <span className="text-white/25">Context window</span>
                <span className="font-mono text-white/40">7.8K / 12K</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-primary-400 to-teal2" />
              </div>
              <p className="mt-1.5 text-[8px] text-white/20">Last indexed just now from {courseTitle}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Topic mastery</h2>
              <span className="flex items-center gap-1 text-[8px] text-teal-300/60">
                <GraduationCap className="h-3 w-3" /> From quiz history
              </span>
            </div>
            {mastery.length ? (
              <div className="mt-3 space-y-2.5">
                {mastery.slice(0, 4).map((item) => (
                  <div key={item.id}>
                    <div className="flex items-center justify-between gap-2 text-[9px]">
                      <span className="truncate text-white/50">{item.topic}</span>
                      <span
                        className={
                          item.status === 'strong'
                            ? 'text-emerald-300'
                            : item.status === 'developing'
                              ? 'text-amber-300'
                              : 'text-rose-300'
                        }
                      >
                        {Math.round(item.mastery)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.055]">
                      <div
                        className={`h-full rounded-full ${
                          item.status === 'strong'
                            ? 'bg-emerald-400'
                            : item.status === 'developing'
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                        }`}
                        style={{ width: `${Math.max(4, Math.min(100, item.mastery))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[7.5px] text-white/20">
                      {item.attempts_count} attempt{item.attempts_count === 1 ? '' : 's'} ·{' '}
                      {item.status === 'strong' ? 'Ready for advanced practice' : item.status === 'developing' ? 'Review recommended' : 'Needs focused review'}
                    </p>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/quiz')}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.05] py-1.5 text-[8.5px] font-medium text-white/30 transition hover:text-white/60"
                >
                  Improve with a quiz <ArrowUpRight className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-white/[0.05] bg-white/[0.018] p-3">
                <p className="text-[9.5px] leading-relaxed text-white/30">
                  Complete a quiz to unlock per-topic mastery. Weak topics are prioritised in your study plan and tutor explanations.
                </p>
                <button
                  onClick={() => navigate('/quiz')}
                  className="mt-2 flex items-center gap-1 text-[9px] font-medium text-primary-200/80 hover:text-primary-100"
                >
                  Take the course quiz <ArrowUpRight className="h-2.5 w-2.5" />
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Semantic sources</h2>
              <span className="font-mono text-[8px] text-teal-300/50">cosine · 0.92</span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {displaySources.map((source) => {
                const Icon = source.icon;
                return (
                  <button
                    key={source.id}
                    onClick={() => openSource(source.id)}
                    className="group flex w-full items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.015] px-2.5 py-2 text-left transition hover:border-primary-400/15 hover:bg-white/[0.03]"
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${source.tone}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[9.5px] font-medium text-white/55 transition group-hover:text-white/80">
                        {source.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[8px] text-white/20">{source.meta}</span>
                    </span>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 text-white/15" />
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => showToast(`Source explorer opened · ${lectureCount * 3 || 0} indexed chunks.`)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.05] py-1.5 text-[8.5px] font-medium text-white/30 transition hover:text-white/60"
            >
              Explore all sources
              <ArrowUpRight className="h-2.5 w-2.5" />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function PivotAnswer({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="animate-fade-up space-y-3">
      <AiHeader />
      <p className="max-w-3xl text-[12.5px] leading-[1.75] text-white/55">
        Randomizing the pivot removes the adversarial pattern. Before each partition, a uniformly random element is
        swapped into the pivot position — so a sorted array is no longer special.
      </p>
      <div className="grid max-w-lg grid-cols-3 gap-2">
        {[
          ['Expected', 'O(n log n)'],
          ['Worst case', 'O(n²)'],
          ['Avg. split', '~n / 2'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="text-[8px] uppercase tracking-[0.1em] text-white/20">{label}</p>
            <p className="mt-1 font-mono text-[11px] font-medium text-primary-200">{value}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onOpen}
        className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2 text-[10px] text-white/40 transition hover:text-white/70"
      >
        <PlayCircle className="h-3 w-3 text-teal-300/60" />
        Watch the explanation · Lecture 4.2
        <span className="ml-2 font-mono text-[8px] text-white/20">00:14:05</span>
      </button>
    </div>
  );
}

function TextAnswer({ text, sources }: { text: string; sources?: Source[] }) {
  return (
    <div className="animate-fade-up space-y-2.5">
      <AiHeader />
      <p className="max-w-3xl whitespace-pre-line text-[12.5px] leading-[1.8] text-white/55">
        <InlineMarkdown text={text} />
      </p>
      {sources && sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sources.slice(0, 4).map((source) => (
            <div
              key={`${source.lecture_id}-${source.timestamp_seconds}`}
              className="flex max-w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.018] px-2.5 py-1.5 text-[8.5px] text-white/30"
              title={source.snippet}
            >
              <PlayCircle className="h-3 w-3 shrink-0 text-teal-300/50" />
              <span className="max-w-[220px] truncate">{source.lecture_title}</span>
              <span className="shrink-0 font-mono text-[7.5px] text-white/20">
                {formatTimestamp(source.timestamp_seconds)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={index} className="font-semibold text-white/78">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={index} className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11.5px] text-teal-200/80">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function AiHeader() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-400 via-primary-500 to-teal2/80 shadow-[0_0_20px_-5px_rgba(139,92,246,0.9)]">
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      <div>
        <p className="text-[11.5px] font-semibold leading-none text-white/90">Vertexon AI Tutor</p>
        <p className="mt-1 text-[9px] leading-none text-white/25">Course-grounded assistant</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex animate-fade-up items-start gap-2.5" role="status" aria-label="Vertexon AI is responding">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-400 via-primary-500 to-teal2/80">
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[11.5px] font-semibold leading-none text-white/90">Vertexon AI</p>
          <span className="flex gap-0.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1 w-1 animate-bounce rounded-full bg-primary-300/70"
                style={{ animationDelay: `${dot * 120}ms`, animationDuration: '900ms' }}
              />
            ))}
          </span>
        </div>
        <p className="mt-1.5 text-[9.5px] text-white/25">
          Searching indexed course material in <span className="text-primary-300/60">SQLite</span>…
        </p>
      </div>
    </div>
  );
}
