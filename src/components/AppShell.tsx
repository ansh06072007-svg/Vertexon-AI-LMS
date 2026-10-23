import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { ToastProvider } from './Toast';
import { useI18n } from '../lib/i18n';

export default function AppShell() {
  const location = useLocation();
  const { t, language } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    const titles: Record<string, string> = {
      '/': 'Dashboard',
      '/learn': 'Learn',
      '/tutor': 'AI Tutor',
      '/lesson': 'Lesson Player',
      '/quiz': 'Practice',
      '/achievements': 'Achievements',
      '/assignments': 'Assignments',
      '/community': 'Community',
      '/instructor': 'Instructor Studio',
      '/instructor/courses': 'My Courses',
      '/instructor/analytics': 'Analytics',
      '/admin': 'Admin Console',
      '/admin/users': 'Users & Roles',
      '/admin/courses': 'Course Approvals',
      '/admin/moderation': 'Moderation',
    };
    document.title = `${t(titles[location.pathname] ?? 'Learn')} · Vertexon.AI`;
  }, [location.pathname, language, t]);

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden bg-[#07060c]">
        {sidebarOpen && (
          <button
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
        )}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_55%_80%_at_45%_0%,rgba(104,65,200,0.09),transparent_70%)]" />
          <Topbar onMenu={() => setSidebarOpen(true)} />
          <main key={location.pathname} className="relative min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
