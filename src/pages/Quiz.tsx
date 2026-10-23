import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Flag,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Quote,
  Sparkles,
  Timer,
  TrendingUp,
} from 'lucide-react';
import ProgressRing from '../components/ProgressRing';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, apiPost, errorMessage } from '../lib/api';
import { formatTime } from '../lib/time';

const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

type QuestionType = 'mcq' | 'multi_select' | 'short_answer';

type Question = {
  id: string;
  prompt: string;
  options: string[];
  question_type: QuestionType;
};

type AnswerValue = {
  selected_index: number | null;
  selected_indexes: number[];
  text_answer: string;
};

type QuizDetail = {
  quiz: {
    id: string;
    title: string;
    description: string;
    course_title: string;
    difficulty: string;
    question_count: number;
    passing_score: number;
  };
  questions: Question[];
};

type ReviewItem = {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  selected_index: number | null;
  selected_indexes: number[];
  text_answer?: string;
  correct_index: number | null;
  correct_indexes: number[];
  accepted_answers: string[];
  is_correct: boolean;
  explanation: string;
};

type Result = {
  score: number;
  correct_count: number;
  total_count: number;
  review: ReviewItem[];
  recommendation: string;
};

const emptyAnswer = (): AnswerValue => ({ selected_index: null, selected_indexes: [], text_answer: '' });

const answerFilled = (answer: AnswerValue | undefined, question: Question | undefined) => {
  if (!answer || !question) return false;
  if (question.question_type === 'short_answer') return answer.text_answer.trim().length > 0;
  if (question.question_type === 'multi_select') return answer.selected_indexes.length > 0;
  return answer.selected_index !== null;
};

const reviewAnswerLabel = (review: ReviewItem | undefined) => {
  if (!review) return 'Answer unavailable';
  if (review.question_type === 'short_answer') {
    return review.accepted_answers[0] || 'See explanation';
  }
  return (review.correct_indexes || [])
    .map((answerIndex) => `${letters[answerIndex]}. ${review.options[answerIndex]}`)
    .join('  ·  ') || 'See explanation';
};

export default function Quiz() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<QuizDetail['quiz'] | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerValue[]>([]);
  const [flagged, setFlagged] = useState<Set<number>>(() => new Set());
  const [hintOpen, setHintOpen] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const TOTAL = questions.length;
  const question = questions[index];
  const answer = answers[index] || emptyAnswer();
  const selected = answer.selected_index;
  const selectedIndexes = answer.selected_indexes;
  const textAnswer = answer.text_answer;
  const percent = TOTAL ? Math.round(((index + 1) / TOTAL) * 100) : 0;
  const answeredCount = questions.filter((item, answerIndex) => answerFilled(answers[answerIndex], item)).length;
  const currentReview = result?.review.find((item) => item.question_id === question?.id);
  const correctCount = result?.correct_count || 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<{ quiz: QuizDetail['quiz']; questions: Array<{ id: string; question_text: string; options: string[]; question_type: string }> }>('/quizzes/q-dsa')
      .then(async (data) => {
        if (cancelled) return;
        const mapped = data.questions.map((item) => ({
          id: item.id,
          prompt: item.question_text,
          options: item.options,
          question_type: (item.question_type || 'mcq') as QuestionType,
        }));
        setQuiz(data.quiz);
        setQuestions(mapped);
        setAnswers(mapped.map(() => emptyAnswer()));
        if (!startedRef.current) {
          startedRef.current = true;
          const attempt = await apiPost<{ attempt: { id: string } }>('/quizzes/q-dsa/attempt');
          if (!cancelled) setAttemptId(attempt.attempt.id);
        }
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
  }, []);

  useEffect(() => {
    if (submitted || reviewing || loading) return;
    const timer = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [submitted, reviewing, loading]);

  const goTo = (nextIndex: number) => {
    setIndex(Math.max(0, Math.min(TOTAL - 1, nextIndex)));
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectOption = (optionIndex: number) => {
    if (reviewing) return;
    setAnswers((current) =>
      current.map((entry, answerIndex) => {
        if (answerIndex !== index) return entry;
        if (question.question_type === 'multi_select') {
          const next = entry.selected_indexes.includes(optionIndex)
            ? entry.selected_indexes.filter((value) => value !== optionIndex)
            : [...entry.selected_indexes, optionIndex].sort((a, b) => a - b);
          return { ...entry, selected_indexes: next, selected_index: next[0] ?? null };
        }
        return { ...entry, selected_index: optionIndex, selected_indexes: [] };
      }),
    );
  };

  const updateTextAnswer = (value: string) => {
    if (reviewing) return;
    setAnswers((current) =>
      current.map((entry, answerIndex) => (answerIndex === index ? { ...entry, text_answer: value } : entry)),
    );
  };

  const toggleFlag = () => {
    if (reviewing) return;
    setFlagged((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
        showToast('Flag removed.');
      } else {
        next.add(index);
        showToast(`Question ${index + 1} flagged for review.`);
      }
      return next;
    });
  };

  const submit = async () => {
    if (!attemptId) {
      showToast('The attempt is still starting — try again in a moment.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiPost<Result>(`/quizzes/attempts/${attemptId}/submit`, {
        answers: questions.map((item, answerIndex) => ({
          question_id: item.id,
          selected_index: answers[answerIndex]?.selected_index ?? -1,
          selected_indexes:
            item.question_type === 'multi_select' ? answers[answerIndex]?.selected_indexes ?? [] : undefined,
          text_answer:
            item.question_type === 'short_answer' ? answers[answerIndex]?.text_answer ?? '' : undefined,
        })),
      });
      setResult(data);
      setSubmitted(true);
      setReviewing(false);
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const finishReview = () => {
    setReviewing(false);
    setSubmitted(true);
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="mx-auto grid min-h-[60vh] w-full max-w-[1440px] place-items-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary-300/60" />
          <p className="mt-3 text-[11px] text-white/35">Loading quiz and starting an attempt…</p>
        </div>
      </div>
    );
  }

  if (error || !quiz || !question) {
    return (
      <div className="mx-auto w-full max-w-[900px] px-4 py-16 text-center">
        <Layers className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-3 text-[14px] font-medium text-white/60">Quiz unavailable</p>
        <p className="mt-1 text-[10.5px] text-white/30">{error || 'This quiz has no questions yet.'}</p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-300/75">
            {quiz.course_title} <span className="h-[3px] w-[3px] rounded-full bg-primary-400/40" />
            <span className="font-medium normal-case tracking-normal text-white/30">Assessment</span>
          </p>
          <h1 className="mt-2 font-display text-[25px] font-bold leading-[1.25] tracking-[-0.03em] text-white sm:text-[28px]">
            {quiz.title}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] text-white/30">
            <span className="flex items-center gap-1.5 text-primary-300/65">
              <Sparkles className="h-3 w-3" /> AI-generated
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
            <span>{TOTAL} questions</span>
            <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
            <span>Approx. {Math.max(2, Math.round(TOTAL * 1.5))} minutes</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 font-mono text-[11.5px] tabular-nums text-white/50">
            <Clock className="h-3.5 w-3.5 text-teal-300/60" />
            {reviewing ? 'Review mode' : formatTime(elapsed)}
          </span>
          {reviewing ? (
            <button onClick={finishReview} className="btn-ghost h-10 px-4 text-[11px]">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to results
            </button>
          ) : (
            <button onClick={() => navigate('/lesson')} className="btn-ghost h-10 px-4 text-[11px]">
              <ArrowLeft className="h-3.5 w-3.5" />
              Exit quiz
            </button>
          )}
        </div>
      </header>

      {submitted ? (
        <ResultView
          correct={result?.correct_count || correctCount}
          total={TOTAL}
          score={result?.score || 0}
          elapsed={elapsed}
          nextStep={result?.recommendation || 'Review the explanations, then revisit the lesson material.'}
          userName={user?.full_name?.split(' ')[0] || 'learner'}
          onReview={() => {
            setSubmitted(false);
            setReviewing(true);
            setIndex(0);
            setHintOpen(false);
            rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          onHome={() => navigate('/')}
        />
      ) : (
        <>
          <div className="mt-5 flex items-center gap-3">
            <span className="shrink-0 text-[10.5px] font-medium text-white/40">
              {reviewing ? 'Reviewing' : 'Question'} {index + 1} <span className="text-white/20">of {TOTAL}</span>
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-400 via-primary-300 to-teal2 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] font-semibold text-teal-300/70">{percent}% complete</span>
          </div>

          <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-md border border-emerald-400/20 bg-emerald-400/[0.09] px-2.5 py-1.5 text-[9.5px] font-semibold text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {question.question_type === 'multi_select'
                      ? 'Multi-select'
                      : question.question_type === 'short_answer'
                        ? 'Short answer'
                        : 'Single choice'}
                  </span>
                  <span className="rounded-md border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 text-[9.5px] text-white/35">
                    Mastery impact <span className="font-semibold text-primary-200/80">+15 pts</span>
                  </span>
                  <button
                    onClick={toggleFlag}
                    disabled={reviewing}
                    className={`ml-auto flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[9.5px] font-medium transition disabled:opacity-35 ${
                      flagged.has(index)
                        ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/55'
                    }`}
                  >
                    <Flag className={`h-3 w-3 ${flagged.has(index) ? 'fill-amber-300' : ''}`} />
                    {flagged.has(index) ? 'Flagged' : 'Flag for review'}
                  </button>
                </div>

                <h2 className="mt-6 max-w-3xl font-display text-[17px] font-semibold leading-[1.55] text-white/90 sm:text-[18px]">
                  {question.prompt}
                </h2>

                {question.question_type === 'short_answer' ? (
                  <div className="mt-5">
                    <label className="block">
                      <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
                        Type your answer
                      </span>
                      <textarea
                        value={textAnswer}
                        onChange={(event) => updateTextAnswer(event.target.value)}
                        disabled={reviewing}
                        rows={3}
                        placeholder="Write a concise answer…"
                        className="form-input min-h-[94px] resize-none py-3 text-[12px] disabled:opacity-65"
                      />
                    </label>
                    <p className="mt-2 text-[9px] leading-relaxed text-white/22">
                      Auto-graded against accepted course terminology. Case and punctuation are ignored.
                    </p>
                    {reviewing && (
                      <div className="mt-3 rounded-xl border border-teal2/15 bg-teal2/[0.04] px-3.5 py-3">
                        <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-teal-300/65">Your response</p>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
                          {textAnswer || 'No answer submitted.'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 grid gap-2.5">
                    {question.question_type === 'multi_select' && (
                      <p className="flex items-center gap-2 text-[9.5px] font-medium text-primary-200/65">
                        <Check className="h-3 w-3" /> Select every option that applies
                      </p>
                    )}
                    {question.options.map((option, optionIndex) => {
                      const isSelected =
                        question.question_type === 'multi_select'
                          ? selectedIndexes.includes(optionIndex)
                          : selected === optionIndex;
                      const isCorrect = Boolean(
                        reviewing && currentReview?.correct_indexes?.includes(optionIndex),
                      );
                      const showCorrect = reviewing && isCorrect;
                      const showWrong = reviewing && isSelected && !isCorrect;
                      return (
                        <button
                          key={option}
                          onClick={() => selectOption(optionIndex)}
                          disabled={reviewing}
                          aria-pressed={isSelected}
                          className={`flex w-full items-center gap-3.5 rounded-xl border px-3.5 py-3.5 text-left transition-all disabled:cursor-default ${
                            showCorrect
                              ? 'border-emerald-400/45 bg-emerald-400/[0.07]'
                              : showWrong
                                ? 'border-rose-400/40 bg-rose-500/[0.06]'
                                : reviewing
                                  ? 'border-white/[0.045] bg-white/[0.01]'
                                  : isSelected
                                    ? 'border-primary-400/55 bg-gradient-to-r from-primary-500/[0.16] to-primary-400/[0.055] shadow-[0_10px_26px_-20px_rgba(139,92,246,0.95)]'
                                    : 'border-white/[0.065] bg-white/[0.018] hover:border-white/[0.12] hover:bg-white/[0.03]'
                          }`}
                        >
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center border font-mono text-[10px] font-semibold transition ${
                              question.question_type === 'multi_select' ? 'rounded-md' : 'rounded-full'
                            } ${
                              showCorrect
                                ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
                                : showWrong
                                  ? 'border-rose-400/30 bg-rose-500/15 text-rose-200'
                                  : isSelected
                                    ? 'border-primary-300/40 bg-primary-500/30 text-primary-100'
                                    : reviewing
                                      ? 'border-white/[0.07] bg-white/[0.02] text-white/25'
                                      : 'border-white/[0.09] bg-white/[0.025] text-white/35'
                            }`}
                          >
                            {letters[optionIndex]}
                          </span>
                          <span
                            className={`flex-1 text-[12px] leading-relaxed ${
                              showCorrect
                                ? 'text-emerald-50/90'
                                : showWrong
                                  ? 'text-rose-100/80'
                                  : reviewing
                                    ? 'text-white/40'
                                    : isSelected
                                      ? 'text-white/90'
                                      : 'text-white/50'
                            }`}
                          >
                            {option}
                          </span>
                          {reviewing ? (
                            showCorrect ? (
                              <span className="flex shrink-0 items-center gap-1.5 text-[9px] font-medium text-emerald-300">
                                Correct answer
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/20">
                                  <Check className="h-3 w-3" strokeWidth={2.5} />
                                </span>
                              </span>
                            ) : showWrong ? (
                              <span className="shrink-0 text-[9px] font-medium text-rose-300">Your answer</span>
                            ) : null
                          ) : isSelected ? (
                            <span className="flex shrink-0 items-center gap-1.5 text-[9px] font-medium text-primary-200">
                              Selected
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-400/25">
                                <Check className="h-3 w-3" strokeWidth={2.5} />
                              </span>
                            </span>
                          ) : (
                            <span
                              className={`h-4 w-4 shrink-0 border border-white/[0.12] ${
                                question.question_type === 'multi_select' ? 'rounded-[4px]' : 'rounded-full'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-4">
                  {reviewing ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-200/60">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-300/80" />
                      Answer walkthrough
                    </span>
                  ) : (
                    <button
                      onClick={() => setHintOpen((current) => !current)}
                      className="flex items-center gap-1.5 text-[10px] font-medium text-amber-200/60 transition hover:text-amber-200"
                    >
                      <Lightbulb className="h-3.5 w-3.5 text-amber-300/80" />
                      Need a hint?
                      <ChevronDown className={`h-3 w-3 transition ${hintOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/tutor')}
                    className="flex items-center gap-1.5 rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1.5 text-[9.5px] font-medium text-primary-200/85 transition hover:bg-primary-500/15"
                  >
                    <Sparkles className="h-3 w-3" />
                    Ask Vertexon Chat
                  </button>
                </div>

                {reviewing ? (
                  <div className="mt-3 animate-fade-up rounded-xl border border-teal2/15 bg-teal2/[0.04] p-4">
                    <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-teal-300/70">
                      Correct answer · {quiz.title}
                    </p>
                    <p className="mt-1.5 text-[11px] font-medium text-emerald-100/80">
                      {reviewAnswerLabel(currentReview)}
                    </p>
                    <p className="mt-2 max-w-3xl text-[10.5px] leading-[1.8] text-white/40">
                      {currentReview?.explanation || 'Review the lesson material for this concept.'}
                    </p>
                  </div>
                ) : (
                  hintOpen && (
                    <div className="mt-3 animate-fade-up rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
                      <div className="flex gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-400/15 bg-amber-400/[0.08]">
                          <Quote className="h-3.5 w-3.5 text-amber-300/80" />
                        </span>
                        <div>
                          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-amber-300/70">
                            Vertexon Socratic Assistant
                          </p>
                          <p className="mt-1.5 max-w-3xl text-[11px] leading-[1.8] text-white/45">
                            “Consider how many times an outgoing edge can be inspected as each vertex is settled. Does an
                            edge ever get relaxed more than once if each vertex is extracted once?”
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                )}

                <div className="mt-5 flex gap-2.5">
                  <button
                    onClick={() => goTo(index - 1)}
                    disabled={index === 0}
                    className="btn-ghost h-11 flex-1 text-[11px] disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <button
                    onClick={() => {
                      if (index === TOTAL - 1) {
                        if (reviewing) finishReview();
                        else submit();
                      } else {
                        goTo(index + 1);
                      }
                    }}
                    disabled={submitting}
                    className="btn-primary h-11 flex-[1.25] text-[11px] disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Grading attempt…
                      </>
                    ) : reviewing ? (
                      index === TOTAL - 1 ? (
                        'Finish review'
                      ) : (
                        'Next answer'
                      )
                    ) : index === TOTAL - 1 ? (
                      'Submit Quiz'
                    ) : (
                      'Next Question'
                    )}
                    {!submitting && (reviewing && index === TOTAL - 1 ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />)}
                  </button>
                </div>
              </section>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[9px] text-white/20">
                <span>{reviewing ? 'Review mode · answers are locked' : 'Auto-graded by Vertexon · objective + short answer'}</span>
                <span className="font-mono">Attempt {formatTime(elapsed)}</span>
              </div>
            </div>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-[13px] font-semibold text-white/90">
                    {reviewing ? 'Review progress' : 'Quiz progress'}
                  </h2>
                  <span className="font-mono text-[8.5px] text-white/25">
                    {answeredCount}/{TOTAL} answered
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-4">
                  <ProgressRing value={percent} size={66} stroke={5} caption={reviewing ? 'Review' : 'Complete'} />
                  <div className="space-y-1.5 text-[10px]">
                    <p className="font-medium text-white/60">
                      {reviewing ? 'Reviewing' : 'Question'} {index + 1} of {TOTAL}
                    </p>
                    <p className="text-white/25">{reviewing ? 'Accuracy' : 'Grading'}</p>
                    <p className="font-mono text-[11.5px] font-semibold text-teal-300/75">
                      {reviewing && answeredCount ? Math.round((correctCount / answeredCount) * 100) : reviewing ? 0 : 'Hidden'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {questions.map((_, questionIndex) => {
                    const isCurrent = questionIndex === index;
                    const isAnswered = answerFilled(answers[questionIndex], questions[questionIndex]);
                    const isFlagged = flagged.has(questionIndex);
                    const isCorrectAnswer = result?.review[questionIndex]?.is_correct;
                    return (
                      <button
                        key={questionIndex}
                        onClick={() => goTo(questionIndex)}
                        aria-label={`Go to question ${questionIndex + 1}`}
                        className={`relative grid h-9 place-items-center rounded-lg border font-mono text-[10px] font-semibold transition ${
                          isCurrent
                            ? 'border-primary-400/50 bg-primary-500/20 text-primary-100'
                            : reviewing
                              ? isCorrectAnswer
                                ? 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200'
                                : 'border-rose-400/20 bg-rose-500/[0.06] text-rose-300/75'
                              : isAnswered
                                ? 'border-teal2/20 bg-teal2/[0.08] text-teal-200/80'
                                : 'border-white/[0.06] bg-white/[0.02] text-white/30 hover:border-white/[0.12] hover:text-white/60'
                        }`}
                      >
                        {questionIndex + 1}
                        {isFlagged && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-300" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.05] pt-3 text-[8px] text-white/25">
                  {reviewing ? (
                    <>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-[3px] border border-emerald-400/30 bg-emerald-400/10" /> Correct
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-[3px] border border-rose-400/25 bg-rose-500/10" /> Incorrect
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-[3px] border border-primary-400/40 bg-primary-500/20" /> Current
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-[3px] border border-teal2/20 bg-teal2/10" /> Answered
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Flagged
                      </span>
                    </>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
                <h2 className="font-display text-[13px] font-semibold text-white/90">Session details</h2>
                <div className="mt-3 space-y-2.5 text-[10px]">
                  {[
                    ['Difficulty', quiz.difficulty || 'Medium'],
                    ['Questions', `${TOTAL} · mixed`],
                    ['Passing score', `${quiz.passing_score || 70}%`],
                    ['Time limit', 'None · practice'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-white/25">{label}</span>
                      <span className="font-medium text-white/55">{value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="relative overflow-hidden rounded-2xl border border-teal2/15 bg-gradient-to-br from-[#0c2421] via-[#0d171a] to-[#100e19] p-4">
                <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-teal2/10 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-teal-300/65">Spaced repetition</p>
                  <span className="rounded-full border border-teal2/20 bg-teal2/[0.09] px-2 py-1 text-[8px] font-medium text-teal-300/80">
                    Due today
                  </span>
                </div>
                <div className="relative mt-3 flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-teal2/20 bg-teal2/10">
                    <Layers className="h-4 w-4 text-teal-300" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-white/75">12 flashcards ready</p>
                    <p className="mt-0.5 text-[8.5px] text-white/30">Dynamic Programming · Module 4</p>
                  </div>
                </div>
                <div className="relative mt-3 flex items-center gap-3 text-[8.5px] text-white/30">
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" /> Est. 5 mins
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-teal-300/50" /> Retention 94%
                  </span>
                </div>
                <button
                  onClick={() => showToast('Flashcard review loaded · 12 cards in this session.')}
                  className="relative mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-teal2/20 bg-teal2/[0.08] text-[9.5px] font-semibold text-teal-200/85 transition hover:bg-teal2/[0.14]"
                >
                  Review Flashcards (5 min)
                  <ArrowRight className="h-3 w-3" />
                </button>
              </section>

              <button
                onClick={() => navigate('/tutor')}
                className="group flex w-full items-center gap-3 rounded-2xl border border-primary-400/15 bg-gradient-to-br from-[#1c1335] to-[#100d19] p-4 text-left transition hover:border-primary-400/30"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary-400/15 bg-primary-500/10 text-primary-200">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10.5px] font-semibold text-white/75">Stuck on a concept?</span>
                  <span className="mt-0.5 block text-[8.5px] text-white/30">Ask AI Tutor with course context</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-primary-200" />
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function ResultView({
  correct,
  total,
  score,
  elapsed,
  nextStep,
  userName,
  onReview,
  onHome,
}: {
  correct: number;
  total: number;
  score: number;
  elapsed: number;
  nextStep: string;
  userName: string;
  onReview: () => void;
  onHome: () => void;
}) {
  const percent = score;

  return (
    <div className="mx-auto mt-6 max-w-4xl animate-fade-up">
      <div className="overflow-hidden rounded-2xl border border-white/[0.065] bg-gradient-to-br from-[#171024] via-[#100d19] to-[#0c0f14]">
        <div className="grid items-center gap-7 p-6 sm:p-8 md:grid-cols-[190px_1fr]">
          <div
            className="relative mx-auto grid h-[160px] w-[160px] place-items-center rounded-full"
            style={{
              background: `conic-gradient(#8b5cf6 0deg, #2dd4bf ${percent * 3.6}deg, rgba(255,255,255,0.07) ${percent * 3.6}deg 360deg)`,
            }}
          >
            <div className="grid h-[138px] w-[138px] place-items-center rounded-full bg-[#0a0812]">
              <div>
                <p className="font-display text-[38px] font-bold leading-none text-white">{percent}%</p>
                <p className="mt-1.5 text-[8px] uppercase tracking-[0.14em] text-white/30">Score</p>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_45px_-10px_rgba(139,92,246,0.55)]" />
          </div>

          <div className="text-center md:text-left">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary-300/80">Quiz complete</p>
            <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-[-0.03em] text-white">
              Nice work, {userName}.
            </h2>
            <p className="mt-1.5 text-[11px] text-white/35">
              {correct} of {total} correct · +{correct * 10} mastery points
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ['Correct', `${correct}/${total}`],
                ['Accuracy', `${percent}%`],
                ['Time', formatTime(elapsed)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left">
                  <p className="font-display text-[17px] font-semibold text-white/85">{value}</p>
                  <p className="mt-1 text-[8px] uppercase tracking-[0.1em] text-white/25">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 border-t border-white/[0.055] bg-primary-500/[0.035] px-6 py-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-primary-400/15 bg-primary-500/10">
            <Sparkles className="h-3.5 w-3.5 text-primary-200" />
          </span>
          <p className="max-w-3xl text-[10.5px] leading-[1.75] text-white/40">
            <span className="font-semibold text-primary-200">AI next step:</span> {nextStep}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.055] px-6 py-4 sm:flex-row">
          <button onClick={onReview} className="btn-ghost h-10 flex-1 text-[10.5px]">
            Review answers
          </button>
          <button onClick={onHome} className="btn-primary h-10 flex-1 text-[10.5px]">
            Back to dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
