import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import Logo from '../components/Logo';
import { homeForRole, roleLabel, useAuth } from '../context/AuthContext';
import type { Role } from '../lib/api';

type AuthMode = 'login' | 'register';

type DemoAccount = {
  role: Role;
  name: string;
  email: string;
  password: string;
  description: string;
};

const demoAccounts: DemoAccount[] = [
  {
    role: 'student',
    name: 'Ananya Sharma',
    email: 'ananya@vertexon.ai',
    password: 'Student123!',
    description: 'Courses · streaks · AI tutor',
  },
  {
    role: 'instructor',
    name: 'Rohit Verma',
    email: 'rohit@vertexon.ai',
    password: 'Instructor123!',
    description: 'Authoring · analytics · grading',
  },
  {
    role: 'admin',
    name: 'Meera Iyer',
    email: 'meera@vertexon.ai',
    password: 'Admin123!',
    description: 'Approvals · roles · moderation',
  },
];

const highlights = [
  { icon: BrainCircuit, title: 'Course-grounded AI tutor', detail: 'Every answer cites the exact lecture or PDF.' },
  { icon: BookOpen, title: 'One focused learning workspace', detail: 'Lessons, notes, quizzes, and progress together.' },
  { icon: ShieldCheck, title: 'Role-aware by design', detail: 'Separate student, instructor, and admin experiences.' },
];

const heroWords = ['always on.', 'grounded.', 'right here.'];

const featureDelays = ['120ms', '220ms', '320ms'];

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [demoRole, setDemoRole] = useState<Role | null>(null);
  const [error, setError] = useState('');
  const [heroWord, setHeroWord] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setHeroWord((current) => (current + 1) % heroWords.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  if (!loading && user) return <Navigate to={homeForRole(user.role)} replace />;

  const destination = (role: Role) => {
    const from = (location.state as { from?: string } | null)?.from;
    return from && from !== '/login' ? from : homeForRole(role);
  };

  const trackCardPointer = (event: PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const signedIn = mode === 'login' ? await login(email, password) : await register(fullName, email, password);
      navigate(destination(signedIn.role), { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const useDemo = async (account: DemoAccount) => {
    setError('');
    setEmail(account.email);
    setPassword(account.password);
    setDemoRole(account.role);
    setSubmitting(true);
    try {
      const signedIn = await login(account.email, account.password);
      navigate(destination(signedIn.role), { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
      setDemoRole(null);
    }
  };

  return (
    <div className="auth-scene relative min-h-dvh overflow-y-auto bg-[#050409]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <span className="auth-aurora auth-aurora-one" />
        <span className="auth-aurora auth-aurora-two" />
        <span className="auth-aurora auth-aurora-three" />
        <span className="auth-grid-overlay" />
        <span className="auth-vignette" />
      </div>

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1500px] lg:grid-cols-[1.07fr_0.93fr]">
        <section className="relative hidden min-h-dvh overflow-hidden border-r border-white/[0.055] px-9 py-8 lg:flex lg:flex-col xl:px-14">
          <div className="auth-rise flex items-center justify-between">
            <Logo subtitle="Learning, amplified" />
            <span className="auth-live-pill">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal2/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal2" />
              </span>
              Systems online
            </span>
          </div>

          <div className="my-auto max-w-[650px] py-9">
            <span className="auth-kicker auth-rise" style={{ animationDelay: '70ms' }}>
              <Sparkles className="h-3 w-3" />
              AI-augmented LMS · v1.0
              <span className="ml-1 h-1 w-1 rounded-full bg-primary-300/70" />
            </span>

            <h1
              className="auth-rise mt-5 max-w-[645px] font-display text-[clamp(33px,3.05vw,44px)] font-bold leading-[1.1] tracking-[-0.052em] text-white"
              style={{ animationDelay: '130ms' }}
            >
              The course is the <span className="auth-context-word">context.</span>
              <br />
              The tutor is{' '}
              <span key={heroWord} className="auth-word text-gradient">
                {heroWords[heroWord]}
              </span>
            </h1>

            <p
              className="auth-rise mt-4 max-w-[500px] text-[13px] leading-[1.9] text-white/38"
              style={{ animationDelay: '200ms' }}
            >
              One focused workspace for lessons, notes, assessments, and a retrieval-grounded tutor that answers from
              your actual course material — even at 11 PM.
            </p>

            <div className="mt-7 space-y-2.5">
              {highlights.map((highlight, index) => {
                const Icon = highlight.icon;
                return (
                  <div
                    key={highlight.title}
                    className="auth-feature auth-rise flex items-start gap-3 rounded-xl border border-transparent px-1 py-1"
                    style={{ animationDelay: featureDelays[index] }}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary-400/15 bg-primary-500/[0.08] text-primary-200 shadow-[0_0_22px_-12px_rgba(154,123,251,0.8)]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-[11.5px] font-semibold text-white/72">{highlight.title}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-white/28">{highlight.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative mt-7 max-w-[525px]">
              <div className="auth-float relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0a16]/88 p-4 shadow-[0_34px_90px_-42px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-primary-500/20 blur-3xl" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary-400 via-primary-500 to-teal2/80">
                      <span className="absolute inset-0 animate-ping rounded-full bg-primary-400/15" />
                      <Sparkles className="relative h-3.5 w-3.5 text-white" />
                    </span>
                    <div>
                      <p className="text-[10.5px] font-semibold text-white/85">Vertexon AI Tutor</p>
                      <p className="text-[8.5px] text-white/25">Grounded in Module 3 · 14 sources</p>
                    </div>
                  </div>
                  <span className="auth-source-chip">RAG live</span>
                </div>

                <div className="relative mt-3 flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/[0.09] bg-white/[0.035] text-[8px] font-bold text-white/45">
                    AS
                  </span>
                  <p className="rounded-xl rounded-tl-sm border border-white/[0.055] bg-white/[0.028] px-3 py-2.5 text-[10.5px] leading-relaxed text-white/55">
                    Why does Dijkstra with an indexed min-heap run in O((V + E) log V)?
                  </p>
                </div>

                <div className="relative mt-3 flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-400 to-teal2/70">
                    <Sparkles className="h-3 w-3 text-white" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10.5px] leading-relaxed text-white/42">
                      Each vertex is extracted once in O(log V). Each edge can trigger one decrease-key, also O(log V),
                      so the total is <span className="font-medium text-primary-200">O((V + E) log V)</span>.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="auth-citation">
                        <Play className="h-2.5 w-2.5" /> Lecture 12 · 00:12:45
                      </span>
                      <span className="auth-citation">
                        <BookOpen className="h-2.5 w-2.5" /> Module notes · p. 17
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative mt-3 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
                  <span className="text-[9px] text-white/20">Ask a follow-up about this lecture…</span>
                  <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-primary-500/20 text-primary-200">
                    <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </div>
              </div>

              <span className="auth-floating-chip auth-floating-chip-a">
                <Zap className="h-2.5 w-2.5 text-amber-300" /> 24/7 tutor
              </span>
              <span className="auth-floating-chip auth-floating-chip-b">
                <CheckCircle2 className="h-2.5 w-2.5 text-teal-300" /> Cited answers
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.055] pt-4 text-[9px] text-white/22">
            <span>© 2026 Vertexon Learning Technologies</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-teal-300/45" /> JWT + RBAC secured
            </span>
          </div>
        </section>

        <section className="relative flex min-h-dvh items-center justify-center px-4 py-7 sm:px-8 lg:px-9 xl:px-14">
          <div className="w-full max-w-[458px]">
            <div className="auth-rise mb-6 flex items-center justify-between lg:hidden">
              <Logo subtitle="Learning, amplified" />
              <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[8px] text-white/30">
                LMS-AI v1.0
              </span>
            </div>

            <div
              ref={cardRef}
              onPointerMove={trackCardPointer}
              className="auth-card-shell auth-rise relative"
              style={{ animationDelay: '180ms' }}
            >
              <div className="auth-card-surface relative z-10 rounded-[24px] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-[0.13em] text-white/40">
                    <ShieldCheck className="h-3 w-3 text-teal-300/70" />
                    Secure sign-in
                  </span>
                  <span className="flex items-center gap-1.5 text-[8px] font-medium uppercase tracking-[0.1em] text-emerald-300/60">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    JWT live
                  </span>
                </div>

                <div className="mt-4">
                  <p className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.18em] text-primary-300/70">
                    <span className="h-px w-4 bg-primary-400/50" />
                    {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
                  </p>
                  <h2 className="mt-2.5 font-display text-[31px] font-bold leading-[1.08] tracking-[-0.04em] text-white sm:text-[34px]">
                    {mode === 'login' ? (
                      <>
                        Sign in to <span className="text-gradient">Vertexon</span>
                      </>
                    ) : (
                      <>
                        Start learning <span className="text-gradient">smarter</span>
                      </>
                    )}
                  </h2>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-white/32">
                    {mode === 'login'
                      ? 'Your courses, progress, and AI tutor are right where you left them.'
                      : 'Create a student account. Instructor accounts are provisioned by an administrator.'}
                  </p>
                </div>

                <form onSubmit={submit} className="mt-5 space-y-3">
                  {mode === 'register' && (
                    <label className="block">
                      <span className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/35">Full name</span>
                      <span className="auth-input-shell">
                        <UserRound className="h-4 w-4 shrink-0 text-white/25" />
                        <input
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          required
                          minLength={2}
                          placeholder="Ananya Sharma"
                          autoComplete="name"
                          className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 focus:outline-none"
                        />
                      </span>
                    </label>
                  )}

                  <label className="block">
                    <span className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/35">Email</span>
                    <span className="auth-input-shell">
                      <Mail className="h-4 w-4 shrink-0 text-white/25" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        placeholder="you@vertexon.ai"
                        autoComplete="email"
                        className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 focus:outline-none"
                      />
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/35">Password</span>
                    <span className="auth-input-shell">
                      <LockKeyhole className="h-4 w-4 shrink-0 text-white/25" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={8}
                        placeholder="At least 8 characters"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="text-white/25 transition hover:text-white/60"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </span>
                  </label>

                  {mode === 'register' && (
                    <label className="block">
                      <span className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/35">Confirm password</span>
                      <span className="auth-input-shell">
                        <LockKeyhole className="h-4 w-4 shrink-0 text-white/25" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          required
                          minLength={8}
                          placeholder="Repeat your password"
                          autoComplete="new-password"
                          className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 focus:outline-none"
                        />
                      </span>
                    </label>
                  )}

                  {error && (
                    <div className="auth-shake rounded-xl border border-rose-400/20 bg-rose-500/[0.07] px-3.5 py-2.5 text-[10.5px] leading-relaxed text-rose-200/90" role="alert">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={submitting} className="btn-primary group h-11 w-full text-[12px] disabled:cursor-not-allowed disabled:opacity-60">
                    {submitting && !demoRole ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {mode === 'login' ? 'Enter your workspace' : 'Create student account'}
                    {!submitting && <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />}
                  </button>
                </form>

                {mode === 'login' && (
                  <div className="mt-5">
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.08]" />
                      <span className="text-[8.5px] font-semibold uppercase tracking-[0.15em] text-white/22">Or enter a demo workspace</span>
                      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.08]" />
                    </div>

                    <div className="mt-3 space-y-2">
                      {demoAccounts.map((account, index) => {
                        const DemoIcon = account.role === 'student' ? GraduationCap : account.role === 'instructor' ? BookOpen : ShieldCheck;
                        const accent =
                          account.role === 'student'
                            ? 'border-primary-400/25 bg-primary-500/[0.12] text-primary-200'
                            : account.role === 'instructor'
                              ? 'border-teal2/25 bg-teal2/[0.1] text-teal-200'
                              : 'border-amber-400/25 bg-amber-400/[0.09] text-amber-200';
                        const busy = demoRole === account.role;
                        return (
                          <button
                            key={account.role}
                            type="button"
                            onClick={() => useDemo(account)}
                            disabled={submitting}
                            aria-busy={busy}
                            className="auth-demo group flex w-full items-center gap-3 rounded-xl border border-white/[0.065] bg-white/[0.018] px-3 py-2.5 text-left disabled:cursor-wait disabled:opacity-60"
                            style={{ animationDelay: `${360 + index * 80}ms` }}
                          >
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${accent} transition-transform duration-300 group-hover:scale-105`}>
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DemoIcon className="h-3.5 w-3.5" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="text-[10.5px] font-semibold text-white/70 transition group-hover:text-white/90">{account.name}</span>
                                <span className="rounded border border-white/[0.07] bg-white/[0.025] px-1.5 py-[1px] text-[7px] font-semibold uppercase tracking-wide text-white/30">
                                  {roleLabel(account.role)}
                                </span>
                              </span>
                              <span className="mt-0.5 block truncate text-[8.5px] text-white/25">
                                {busy ? 'Opening your workspace…' : account.description}
                              </span>
                            </span>
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/[0.06] text-white/20 transition duration-300 group-hover:border-primary-400/25 group-hover:bg-primary-500/10 group-hover:text-primary-200">
                              <ArrowRight className="h-2.5 w-2.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="mt-5 text-center text-[10.5px] text-white/28">
                  {mode === 'login' ? (
                    <>
                      New to Vertexon?{' '}
                      <Link to="/register" className="font-medium text-primary-300 transition hover:text-primary-200">
                        Create an account
                      </Link>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <Link to="/login" className="font-medium text-primary-300 transition hover:text-primary-200">
                        Sign in
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="auth-rise mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[8.5px] text-white/18" style={{ animationDelay: '500ms' }}>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Keyboard accessible</span>
              <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" /> 3 role workspaces</span>
              <span className="flex items-center gap-1"><Star className="h-2.5 w-2.5" /> Seeded demo data</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
