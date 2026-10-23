import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { homeForRole, useAuth } from '../context/AuthContext';
import type { Role } from '../lib/api';

function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#050409]">
      <div className="flex flex-col items-center gap-4">
        <Logo subtitle="Learning, amplified" />
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-400/30 border-t-primary-300" />
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">Opening workspace</p>
      </div>
    </div>
  );
}

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

export { FullPageLoader };
