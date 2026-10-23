import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Compass,
  Flame,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Logo from './Logo';
import Avatar from './Avatar';
import { useToast } from './Toast';
import { roleLabel, useAuth } from '../context/AuthContext';
import { useI18n } from '../lib/i18n';
import type { Role } from '../lib/api';

type NavEntry = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const studentNav: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/learn', label: 'Learn', icon: Compass },
  { to: '/tutor', label: 'AI Tutor', icon: Sparkles, badge: 'AI' },
  { to: '/assignments', label: 'Assignments', icon: ClipboardCheck },
  { to: '/community', label: 'Community', icon: MessageSquare },
];

const studentSecondary: NavEntry[] = [
  { to: '/quiz', label: 'Practice', icon: Target },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/achievements', label: 'Certificates', icon: Award },
];

const instructorNav: NavEntry[] = [
  { to: '/instructor', label: 'Overview', icon: LayoutDashboard },
  { to: '/instructor/courses', label: 'My courses', icon: BookOpen },
  { to: '/instructor/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/assignments', label: 'Grading', icon: ClipboardCheck },
  { to: '/community', label: 'Community', icon: MessageSquare },
  { to: '/tutor', label: 'AI Tutor', icon: Sparkles, badge: 'AI' },
];

const adminNav: NavEntry[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/users', label: 'Users & roles', icon: Users },
  { to: '/admin/moderation', label: 'Moderation', icon: ShieldCheck },
  { to: '/community', label: 'Community', icon: MessageSquare },
];

const navForRole = (role: Role) => (role === 'admin' ? adminNav : role === 'instructor' ? instructorNav : studentNav);
const secondaryForRole = (role: Role) => (role === 'student' ? studentSecondary : []);

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

function isRouteActive(pathname: string, to: string) {
  if (to === '/' || to === '/instructor' || to === '/admin') return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { user, streak, logout } = useAuth();
  const role = user?.role || 'student';
  const primaryNav = navForRole(role);
  const secondaryNav = secondaryForRole(role);

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[252px] shrink-0 flex-col border-r border-white/[0.06] bg-[#090810] transition-transform duration-300 lg:static lg:z-20 lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-[70px] shrink-0 items-center justify-between border-b border-white/[0.055] px-5">
        <Logo />
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-white/40 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
        <button
          onClick={() => showToast(`${roleLabel(role)} workspace is active.`)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 text-left transition hover:border-white/[0.12] hover:bg-white/[0.04]"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary-500/30 to-teal2/10 ring-1 ring-primary-400/20">
            {role === 'admin' ? <ShieldCheck className="h-3.5 w-3.5 text-teal-200" /> : role === 'instructor' ? <GraduationCap className="h-3.5 w-3.5 text-primary-100" /> : <span className="text-[10px] font-bold text-primary-100">V</span>}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/25">{t('Workspace')}</span>
            <span className="mt-0.5 block truncate text-[12px] font-medium text-white/70">{roleLabel(role)} · Vertexon</span>
          </span>
          <span className="text-[8px] text-white/20">⌄</span>
        </button>

        <nav className="mt-5">
          <p className="px-2.5 text-[9px] font-bold uppercase tracking-[0.17em] text-white/20">
            {role === 'admin' ? t('Governance') : role === 'instructor' ? t('Studio') : t('Overview')}
          </p>
          <div className="mt-2 space-y-0.5">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isRouteActive(location.pathname, item.to);
              return (
                <NavLink
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[12.5px] font-medium transition ${
                    active
                      ? 'bg-primary-500/[0.12] text-primary-100'
                      : 'text-white/40 hover:bg-white/[0.03] hover:text-white/75'
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary-300" />}
                  <Icon
                    className={`h-4 w-4 ${active ? 'text-primary-300' : 'text-white/30 group-hover:text-white/55'}`}
                    strokeWidth={active ? 2 : 1.7}
                  />
                  <span className="flex-1">{t(item.label)}</span>
                  {item.badge && (
                    <span className="rounded border border-primary-400/20 bg-primary-500/10 px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wide text-primary-300">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {secondaryNav.length > 0 && (
          <nav className="mt-5">
            <p className="px-2.5 text-[9px] font-bold uppercase tracking-[0.17em] text-white/20">{t('More')}</p>
            <div className="mt-2 space-y-0.5">
              {secondaryNav.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(location.pathname, item.to);
                return (
                  <NavLink
                    key={`${item.to}-${item.label}`}
                    to={item.to}
                    onClick={onClose}
                    className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[12.5px] font-medium transition ${
                      active ? 'bg-white/[0.035] text-white/75' : 'text-white/40 hover:bg-white/[0.03] hover:text-white/75'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-white/30 group-hover:text-white/55" strokeWidth={1.7} />
                    {t(item.label)}
                  </NavLink>
                );
              })}
              <button
                onClick={() => showToast('Settings · profile, notifications, and learning preferences.')}
                className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[12.5px] font-medium text-white/40 transition hover:bg-white/[0.03] hover:text-white/75"
              >
                <Settings className="h-4 w-4 text-white/30 group-hover:text-white/55" strokeWidth={1.7} />
                {t('Settings')}
              </button>
            </div>
          </nav>
        )}

        {role === 'student' ? (
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-gradient-to-br from-[#1b1230] to-[#0f0d17] p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-orange-200/70">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                {t('Weekly streak')}
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-[1px] text-[8px] font-bold text-emerald-300">
                {(streak?.current_streak || 0) >= 7 ? 'TOP 4%' : 'KEEP GOING'}
              </span>
            </div>
            <p className="mt-2 font-display text-[19px] font-bold leading-none text-white">
              {streak?.current_streak || 0} <span className="text-[10px] font-medium text-white/30">{t('days')}</span>
            </p>
            <p className="mt-1.5 text-[9.5px] leading-snug text-white/30">
              {streak?.current_streak ? '1 day until your next badge' : 'Watch a lesson to start your streak'}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-primary-400"
                style={{ width: `${Math.min(100, Math.max(12, (streak?.current_streak || 0) * 11))}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-gradient-to-br from-[#101d24] to-[#0f0d17] p-3">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-200/70">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-300" />
              {role === 'admin' ? 'Governance live' : 'Teaching live'}
            </span>
            <p className="mt-2 text-[9.5px] leading-relaxed text-white/30">
              {role === 'admin'
                ? 'Approvals, role changes, and moderation actions are audit-logged.'
                : 'Learner progress and quiz signals update as students learn.'}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.055] p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
          <Avatar name={user?.full_name || 'Vertexon User'} size={30} online />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-semibold text-white/80">{user?.full_name || 'Vertexon User'}</p>
            <p className="mt-0.5 truncate text-[9px] text-white/25">{roleLabel(role)}{user?.headline ? ` · ${user.headline.split('—')[0].trim()}` : ''}</p>
          </div>
          <button
            onClick={signOut}
            className="grid h-6 w-6 place-items-center rounded-md text-white/25 transition hover:bg-rose-400/[0.08] hover:text-rose-200"
            aria-label={t('Sign out')}
            title={t('Sign out')}
          >
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </div>
    </aside>
  );
}
