import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Crown,
  Flame,
  Loader2,
  Lock,
  Medal,
  Share2,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import ProgressRing from '../components/ProgressRing';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, downloadApi, errorMessage } from '../lib/api';

const activity = [
  { day: 'Mon', value: 58, minutes: 34 },
  { day: 'Tue', value: 76, minutes: 46 },
  { day: 'Wed', value: 46, minutes: 28 },
  { day: 'Thu', value: 88, minutes: 53, today: true },
  { day: 'Fri', value: 64, minutes: 38 },
  { day: 'Sat', value: 40, minutes: 24 },
  { day: 'Sun', value: 52, minutes: 31 },
];

type ApiBadge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  earned_at?: string;
};

type Gamification = {
  streak: { current_streak: number; longest_streak: number };
  badges: ApiBadge[];
  all_badges: ApiBadge[];
  quiz_attempts: number;
  level: number;
  xp: number;
  next_level_xp: number;
};

type Certificate = {
  id: string;
  course_title: string;
  credential_id: string;
  issued_at: string;
  certificate_url: string;
};

type LeaderboardRow = {
  id: string;
  full_name: string;
  current_streak: number;
  points: number;
};

type Dashboard = {
  streak: { current_streak: number; longest_streak: number };
  stats: { completed_lessons: number; hours_learned: number; completed_courses: number };
  certificates: Certificate[];
  leaderboard: LeaderboardRow[];
};

const badgeIcons: Record<string, LucideIcon> = {
  trophy: Trophy,
  flame: Flame,
  target: Target,
  zap: Zap,
  users: Users,
  crown: Crown,
  medal: Medal,
};

const badgeTones: Record<string, string> = {
  trophy: 'from-amber-400/25 to-orange-500/5 text-amber-300 border-amber-400/20',
  flame: 'from-rose-400/25 to-orange-500/5 text-rose-300 border-rose-400/20',
  target: 'from-teal2/25 to-emerald-500/5 text-teal-300 border-teal2/20',
  zap: 'from-primary-400/25 to-primary-500/5 text-primary-300 border-primary-400/20',
  users: 'from-sky-400/25 to-sky-500/5 text-sky-300 border-sky-400/20',
  crown: 'from-fuchsia-400/25 to-fuchsia-500/5 text-fuchsia-300 border-fuchsia-400/20',
  medal: 'from-amber-400/25 to-orange-500/5 text-amber-300 border-amber-400/20',
};

export default function Achievements() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [gamification, setGamification] = useState<Gamification | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Gamification>('/gamification/me'),
      api<Dashboard>('/dashboard/me'),
    ])
      .then(([gameData, dashboardData]) => {
        setGamification(gameData);
        setDashboard(dashboardData);
      })
      .catch((caught) => showToast(errorMessage(caught)))
      .finally(() => setLoading(false));
  }, []);

  const earnedIds = new Set(gamification?.badges.map((badge) => badge.id) || []);
  const badgeList = (gamification?.all_badges || []).map((badge) => ({
    ...badge,
    icon: badgeIcons[badge.icon] || Medal,
    tone: badgeTones[badge.icon] || badgeTones.medal,
    earned: earnedIds.has(badge.id),
    progress: '',
    percent: 0,
  }));
  const earnedCount = badgeList.filter((badge) => badge.earned).length;
  const nextBadge = badgeList.find((badge) => !badge.earned);
  const currentStreak = gamification?.streak.current_streak || 0;
  const longestStreak = gamification?.streak.longest_streak || 0;
  const level = gamification?.level || 1;
  const xp = gamification?.xp || 0;
  const levelFloor = (level - 1) * 500;
  const levelProgress = Math.min(100, Math.round(((xp - levelFloor) / 500) * 100));
  const certificate = dashboard?.certificates[0];
  const leaderboard = (dashboard?.leaderboard || []).slice(0, 4);

  const shareProgress = async () => {
    const summary = `I just hit a ${currentStreak}-day learning streak on Vertexon.AI — ${xp.toLocaleString()} XP, Level ${level}.`;
    try {
      await navigator.clipboard.writeText(summary);
      showToast('Progress summary copied to clipboard.');
    } catch {
      showToast('Progress summary ready to share.');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto grid min-h-[60vh] w-full max-w-[1440px] place-items-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary-300/60" />
          <p className="mt-3 text-[11px] text-white/35">Gathering your milestones…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-300/75">Milestones</p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Small steps, <span className="text-gradient">big momentum.</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-white/35">
            Your consistency is compounding. Keep the streak alive and unlock the next tier of achievements.
          </p>
        </div>
        <button onClick={shareProgress} className="btn-ghost h-10 self-start px-4 text-[11px] lg:self-auto">
          <Share2 className="h-3.5 w-3.5" />
          Share progress
        </button>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {[
          { label: 'Current streak', value: `${currentStreak} days`, meta: `Best ${longestStreak} days`, icon: Flame, tint: 'text-orange-300', ring: 'border-orange-400/15 bg-orange-400/[0.06]' },
          { label: 'Total XP', value: xp.toLocaleString(), meta: `${gamification?.quiz_attempts || 0} graded ${gamification?.quiz_attempts === 1 ? 'quiz' : 'quizzes'}`, icon: Star, tint: 'text-amber-300', ring: 'border-amber-400/15 bg-amber-400/[0.06]' },
          { label: 'Current level', value: `Level ${level}`, meta: `${Math.max(0, (gamification?.next_level_xp || 500) - xp)} XP to level ${level + 1}`, icon: Sparkles, tint: 'text-primary-300', ring: 'border-primary-400/15 bg-primary-500/[0.07]' },
          { label: 'Study circle', value: `#${Math.max(1, leaderboard.findIndex((row) => row.id === user?.id) + 1)}`, meta: `${leaderboard.length} active learners`, icon: TrendingUp, tint: 'text-teal-300', ring: 'border-teal2/15 bg-teal2/[0.06]' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#100d19] px-4 py-3.5">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${stat.ring}`}>
                <Icon className={`h-[18px] w-[18px] ${stat.tint}`} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-[19px] font-bold leading-none tracking-[-0.02em] text-white/90">{stat.value}</p>
                <p className="mt-1 text-[8.5px] uppercase tracking-[0.1em] text-white/25">{stat.label}</p>
                <p className="mt-0.5 truncate text-[8.5px] text-white/25">{stat.meta}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_356px]">
        <div className="min-w-0">
          <section className="relative overflow-hidden rounded-2xl border border-rose-400/20 bg-gradient-to-br from-[#2c1722] via-[#1b1120] to-[#0f0c16] p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-rose-200/55">Current streak</p>
                <p className="mt-1.5 font-display text-[42px] font-bold leading-none tracking-[-0.04em] text-white">
                  {currentStreak} <span className="text-[14px] font-medium text-white/30">days</span>
                </p>
                <p className="mt-2 text-[10px] text-white/35">
                  Longest streak <span className="font-semibold text-white/65">{longestStreak} days</span>
                  <span className="mx-2 text-white/15">·</span>
                  Goal <span className="font-semibold text-white/65">30 min / day</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden rounded-full border border-orange-400/15 bg-orange-400/[0.07] px-2.5 py-1.5 text-[8.5px] text-orange-200/65 sm:block">
                  {currentStreak >= 14 ? 'Streak record set' : `${Math.max(0, 14 - currentStreak)} days until record`}
                </span>
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-orange-400/25 bg-gradient-to-br from-orange-400/25 to-rose-500/10">
                  <Flame className="h-7 w-7 fill-orange-400/30 text-orange-400" />
                </div>
              </div>
            </div>

            <div className="relative mt-6 grid grid-cols-7 items-end gap-2">
              {activity.map((item, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <span className={`text-[8px] font-mono ${item.today ? 'text-primary-200' : 'text-white/20'}`}>
                    {item.minutes}m
                  </span>
                  <div className="flex h-[104px] w-full items-end justify-center">
                    <div
                      className={`w-full rounded-t-lg transition-all ${
                        item.today
                          ? 'bg-gradient-to-t from-primary-500/70 to-teal2/80 shadow-[0_0_18px_rgba(139,92,246,0.45)]'
                          : 'bg-gradient-to-t from-primary-500/25 to-primary-300/35'
                      }`}
                      style={{ height: `${item.value}%` }}
                    />
                  </div>
                  <span className={`text-[9px] font-medium ${item.today ? 'text-primary-200' : 'text-white/25'}`}>
                    {item.day}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative mt-5 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3.5 text-[9px] text-white/25">
              <span>Hours learned <span className="font-semibold text-white/55">{dashboard?.stats.hours_learned || 0}h</span></span>
              <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
              <span>Best day <span className="font-semibold text-white/55">Thursday · 53m</span></span>
              <span className="ml-auto flex items-center gap-1 text-teal-300/60">
                <TrendingUp className="h-3 w-3" /> +18% vs last week
              </span>
            </div>
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-white">Badges</h2>
                <p className="mt-0.5 text-[9.5px] text-white/25">Milestones you have unlocked on your learning journey</p>
              </div>
              <span className="text-[9px] text-white/25">{earnedCount} of {badgeList.length} earned</span>
            </div>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {badgeList.map((badge) => {
                const Icon = badge.icon;
                return (
                  <button
                    key={badge.name}
                    onClick={() =>
                      showToast(
                        badge.earned
                          ? `${badge.name} · ${badge.description}`
                          : `Locked · ${badge.criteria.replace(/_/g, ' ')} — ${badge.description}`,
                      )
                    }
                    className={`group relative flex min-h-[132px] flex-col items-start rounded-xl border p-4 text-left transition hover:brightness-110 ${
                      badge.earned
                        ? `bg-gradient-to-br ${badge.tone}`
                        : 'border-white/[0.06] bg-white/[0.015]'
                    }`}
                  >
                    <div className="flex w-full items-start justify-between">
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-full border ${
                          badge.earned ? badge.tone : 'border-white/10 bg-white/[0.03] text-white/30'
                        }`}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      {badge.earned ? (
                        <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[7.5px] font-semibold uppercase tracking-[0.08em] text-white/55">
                          <Check className="h-2.5 w-2.5" /> Earned
                        </span>
                      ) : (
                        <span className="grid h-6 w-6 place-items-center rounded-full border border-white/[0.06] bg-black/15">
                          <Lock className="h-3 w-3 text-white/25" />
                        </span>
                      )}
                    </div>

                    <p className={`mt-3 text-[11.5px] font-semibold leading-tight ${badge.earned ? 'text-white/80' : 'text-white/45'}`}>
                      {badge.name}
                    </p>
                    <p className="mt-1 text-[9px] leading-relaxed text-white/25">{badge.description}</p>

                    {!badge.earned && badge.progress && (
                      <div className="mt-auto w-full pt-2.5">
                        <div className="flex items-center justify-between text-[8px]">
                          <span className="text-white/20">{badge.progress}</span>
                          <span className="font-mono text-white/25">{badge.percent}%</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary-400 to-teal2"
                            style={{ width: `${badge.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <button onClick={() => navigate('/learn')} className="btn-ghost h-10 flex-1 text-[10.5px]">
              <BookOpen className="h-3.5 w-3.5" />
              Explore your next course
            </button>
            <button
              onClick={() => showToast('Achievement timeline opened · 12 milestones this month.')}
              className="btn-ghost h-10 flex-1 text-[10.5px]"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-300/60" />
              View achievement timeline
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Level progress</h2>
              <span className="rounded-full border border-primary-400/15 bg-primary-500/[0.07] px-2 py-0.5 text-[8px] font-semibold text-primary-200/75">
                Level {level}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <ProgressRing value={levelProgress} size={66} stroke={5} caption={`To L${level + 1}`} />
              <div className="space-y-1.5 text-[10px]">
                <p className="font-medium text-white/60">{Math.max(0, (gamification?.next_level_xp || 500) - xp)} XP to Level {level + 1}</p>
                <p className="text-white/25">{xp.toLocaleString()} total XP earned</p>
                <p className="flex items-center gap-1 text-teal-300/65">
                  <TrendingUp className="h-3 w-3" /> {gamification?.quiz_attempts || 0} graded {gamification?.quiz_attempts === 1 ? 'quiz' : 'quizzes'}
                </p>
              </div>
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-white/[0.05] pt-3">
              <div>
                <p className="font-display text-[15px] font-semibold text-white/80">{currentStreak}</p>
                <p className="mt-0.5 text-[8px] uppercase tracking-[0.08em] text-white/20">Day streak</p>
              </div>
              <div>
                <p className="font-display text-[15px] font-semibold text-white/80">{dashboard?.stats.completed_lessons || 0}</p>
                <p className="mt-0.5 text-[8px] uppercase tracking-[0.08em] text-white/20">Lessons done</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Weekly goal</h2>
              <span className="font-mono text-[8.5px] text-white/25">{Math.min(5, dashboard?.stats.completed_lessons || 0)} / 5 lessons</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="font-display text-[20px] font-semibold text-white/85">{dashboard?.stats.hours_learned || 0}h</p>
                <p className="mt-0.5 text-[8.5px] text-white/25">of your 5h weekly target</p>
              </div>
              <span className="text-[9px] font-semibold text-teal-300/70">{Math.min(100, Math.round(((dashboard?.stats.hours_learned || 0) / 5) * 100))}%</span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-teal2" style={{ width: `${Math.min(100, Math.round(((dashboard?.stats.hours_learned || 0) / 5) * 100))}%` }} />
            </div>
            <p className="mt-2 text-[8px] text-white/20">{Math.max(0, 5 - (dashboard?.stats.hours_learned || 0)).toFixed(1)} hours to hit your weekly goal.</p>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-primary-400/15 bg-gradient-to-br from-[#1c1335] to-[#100d19] p-4">
            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary-500/15 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-primary-300/65">Next badge</p>
              <Zap className="h-4 w-4 text-primary-300/60" />
            </div>
            <div className="relative mt-2.5 flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary-400/20 bg-primary-500/10">
                <Zap className="h-4 w-4 text-primary-300" />
              </span>
              <div>
                <p className="text-[11px] font-semibold text-white/80">{nextBadge?.name || 'All badges unlocked'}</p>
                <p className="mt-0.5 text-[8.5px] text-white/25">
                  {nextBadge?.description || 'You have earned every available badge.'}
                </p>
              </div>
            </div>
            <div className="relative mt-3 flex items-center justify-between text-[8px]">
              <span className="text-white/25">{nextBadge ? nextBadge.criteria.replace(/_/g, ' ') : 'Complete'}</span>
              <span className="font-mono text-primary-200/70">{earnedCount}/{badgeList.length}</span>
            </div>
            <div className="relative mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-teal2" style={{ width: `${badgeList.length ? Math.round((earnedCount / badgeList.length) * 100) : 0}%` }} />
            </div>
            <button
              onClick={() => navigate('/lesson')}
              className="relative mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-primary-400/20 bg-primary-500/[0.08] text-[9px] font-semibold text-primary-200/85 transition hover:bg-primary-500/[0.14]"
            >
              Continue learning
              <ArrowRight className="h-3 w-3" />
            </button>
          </section>

          <section className="rounded-2xl border border-amber-400/15 bg-gradient-to-br from-[#211808] via-[#18120d] to-[#100d16] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-400/20 bg-amber-400/[0.09]">
                <Award className="h-5 w-5 text-amber-300" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[7.5px] font-bold uppercase tracking-[0.12em] text-amber-300/60">
                  {certificate ? 'Certificate earned' : 'Certificate locked'}
                </p>
                <p className="mt-1 truncate text-[11px] font-semibold text-white/80">
                  {certificate?.course_title || 'Complete a course to earn yours'}
                </p>
                <p className="mt-0.5 text-[8px] text-white/25">
                  {certificate
                    ? `Issued ${new Date(certificate.issued_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} · Credential ${certificate.credential_id}`
                    : 'Finish a course and pass its assessments.'}
                </p>
              </div>
            </div>
            <button
              disabled={!certificate}
              onClick={async () => {
                if (!certificate) return;
                try {
                  await downloadApi(`/certificates/${certificate.id}/download`, `vertexon-${certificate.credential_id}.pdf`);
                  showToast('Certificate PDF downloaded.');
                } catch (caught) {
                  showToast(errorMessage(caught));
                }
              }}
              className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.08] text-[9px] font-semibold text-amber-200/85 transition hover:bg-amber-400/[0.13] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {certificate ? 'Download certificate' : 'Certificate unavailable'}
              <ArrowRight className="h-3 w-3" />
            </button>
          </section>

          <section className="rounded-2xl border border-white/[0.065] bg-[#100d19] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white/90">Study circle</h2>
              <span className="text-[8px] text-teal-300/60">{leaderboard.length} learners</span>
            </div>
            <div className="mt-2.5 space-y-1">
              {leaderboard.map((person, index) => {
                const isYou = person.id === user?.id;
                return (
                  <div
                    key={person.id}
                    className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 ${isYou ? 'border border-primary-400/15 bg-primary-500/[0.07]' : ''}`}
                  >
                    <span className={`w-3 font-mono text-[9px] ${isYou ? 'text-primary-200/70' : 'text-white/25'}`}>{index + 1}</span>
                    <Avatar name={person.full_name} size={22} online={isYou} />
                    <span className={`min-w-0 flex-1 truncate text-[9.5px] ${isYou ? 'font-medium text-white/70' : 'text-white/45'}`}>
                      {isYou ? `${person.full_name.split(' ')[0]} · You` : person.full_name}
                    </span>
                    <span className={`font-mono text-[8.5px] ${isYou ? 'text-primary-200/70' : 'text-white/25'}`}>{person.points} XP</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => showToast('Cohort leaderboard opened · you are #82 of 2,140 learners (top 4%).')}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.05] py-1.5 text-[8.5px] font-medium text-white/30 transition hover:text-white/60"
            >
              View cohort leaderboard
              <ChevronRight className="h-2.5 w-2.5" />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
