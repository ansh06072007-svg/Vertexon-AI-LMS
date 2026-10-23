import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, HelpCircle, Languages, LogOut, Menu, Search, Settings, ShieldCheck } from 'lucide-react';
import Avatar from './Avatar';
import Logo from './Logo';
import { useToast } from './Toast';
import { roleLabel, useAuth } from '../context/AuthContext';
import { apiPut } from '../lib/api';
import { useI18n } from '../lib/i18n';

const shortcutLabel =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

const pageMeta: Record<string, { title: string; eyebrow: string }> = {
  '/': { title: 'Dashboard', eyebrow: 'Overview' },
  '/learn': { title: 'Learn', eyebrow: 'Course catalog' },
  '/tutor': { title: 'AI Tutor', eyebrow: 'Course-grounded assistance' },
  '/lesson': { title: 'Lesson Player', eyebrow: 'Data Structures & Algorithms' },
  '/quiz': { title: 'Practice', eyebrow: 'Graph Theory & Shortest Path' },
  '/achievements': { title: 'Achievements', eyebrow: 'Milestones & certificates' },
  '/assignments': { title: 'Assignments', eyebrow: 'Coursework & feedback' },
  '/community': { title: 'Community', eyebrow: 'Discussions & study circle' },
  '/instructor': { title: 'Instructor Studio', eyebrow: 'Teaching overview' },
  '/instructor/courses': { title: 'My Courses', eyebrow: 'Authoring & curriculum' },
  '/instructor/analytics': { title: 'Analytics', eyebrow: 'Learning intelligence' },
  '/admin': { title: 'Admin Console', eyebrow: 'Platform governance' },
  '/admin/courses': { title: 'Course Approvals', eyebrow: 'Content governance' },
  '/admin/users': { title: 'Users & Roles', eyebrow: 'Access control' },
  '/admin/moderation': { title: 'Moderation', eyebrow: 'Trust & safety' },
};

type TopbarProps = {
  onMenu: () => void;
};

export default function Topbar({ onMenu }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { language, toggleLanguage, t } = useI18n();
  const { user, unreadNotifications, refreshSummary, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const meta = pageMeta[location.pathname] ?? pageMeta['/'];
  const role = user?.role || 'student';

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [profileOpen]);

  const search = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/learn?q=${encodeURIComponent(trimmed)}`);
  };

  const readNotifications = async () => {
    if (unreadNotifications <= 0) {
      showToast(t('No new notifications. You are all caught up.'));
      return;
    }
    try {
      await apiPut('/notifications/read-all');
      await refreshSummary();
      showToast(`${unreadNotifications} notification${unreadNotifications === 1 ? '' : 's'} marked as read.`);
    } catch {
      showToast('Could not update notifications right now.');
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-[70px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.055] bg-[#08070d]/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenu}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-white/50 hover:text-white lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="hidden lg:block">
          <Logo markOnly size={20} />
        </div>
        <div className="min-w-0">
          <p className="hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20 sm:block">
            Vertexon LMS <span className="mx-1 text-white/10">/</span> {t(meta.eyebrow)}
          </p>
          <h1 className="truncate font-display text-[15.5px] font-semibold tracking-[-0.015em] text-white/90">{t(meta.title)}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
          className="hidden h-9 w-[280px] items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 transition focus-within:border-primary-400/30 focus-within:bg-white/[0.035] md:flex xl:w-[340px]"
        >
          <Search className="h-4 w-4 shrink-0 text-white/25" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search courses, lessons, notes...')}
            aria-label="Search the platform"
            aria-keyshortcuts="Control+K Meta+K"
            className="h-full min-w-0 flex-1 bg-transparent text-[11.5px] text-white/70 placeholder:text-white/20 focus:outline-none"
          />
          <kbd className="rounded border border-white/[0.08] bg-white/[0.03] px-1 py-[1px] text-[8px] text-white/20">{shortcutLabel}</kbd>
        </form>

        <button
          onClick={readNotifications}
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-white/40 transition hover:border-white/[0.12] hover:text-white/80"
          aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadNotifications > 0 && (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_#f59e0b]" />
          )}
        </button>

        <button
          onClick={() => showToast('Help center · docs.vertexon.ai')}
          className="hidden h-9 w-9 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-white/40 transition hover:border-white/[0.12] hover:text-white/80 sm:grid"
          aria-label="Help"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => {
            toggleLanguage();
            showToast(language === 'en' ? 'भाषा हिंदी में बदल गई।' : 'Language switched to English.');
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 text-white/40 transition hover:border-white/[0.12] hover:text-white/80"
          aria-label={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
          title={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="text-[8.5px] font-semibold uppercase tracking-wide">{language === 'en' ? 'हि' : 'EN'}</span>
        </button>

        <div className="mx-1 hidden h-6 w-px bg-white/[0.07] sm:block" />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((current) => !current)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1 text-left transition hover:bg-white/[0.03] sm:pr-2"
          >
            <Avatar name={user?.full_name || 'Vertexon User'} size={31} online />
            <span className="hidden text-left sm:block">
              <span className="block text-[11.5px] font-semibold leading-tight text-white/80">{user?.full_name || 'Vertexon User'}</span>
              <span className="mt-0.5 block text-[9px] leading-tight text-white/25">{roleLabel(role)}</span>
            </span>
            <ChevronDown className={`hidden h-3 w-3 text-white/20 transition sm:block ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 z-50 w-[250px] overflow-hidden rounded-xl border border-white/[0.09] bg-[#100d19] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]" role="menu">
              <div className="border-b border-white/[0.055] px-3.5 py-3">
                <p className="text-[11px] font-semibold text-white/80">{user?.full_name}</p>
                <p className="mt-0.5 truncate text-[8.5px] text-white/25">{user?.email}</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded border border-primary-400/15 bg-primary-500/[0.07] px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wide text-primary-300">
                  <ShieldCheck className="h-2 w-2" /> {roleLabel(role)}
                </span>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  showToast('Settings · profile, notifications, and learning preferences.');
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[10px] text-white/40 transition hover:bg-white/[0.03] hover:text-white/75"
                role="menuitem"
              >
                <Settings className="h-3.5 w-3.5" /> {t('Account settings')}
              </button>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[10px] text-rose-200/65 transition hover:bg-rose-400/[0.06] hover:text-rose-200"
                role="menuitem"
              >
                <LogOut className="h-3.5 w-3.5" /> {t('Sign out')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
