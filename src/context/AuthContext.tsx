import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, apiPost, errorMessage, homeForRole, tokenStore, type Role, type SessionUser } from '../lib/api';

type Streak = {
  current_streak: number;
  longest_streak: number;
  last_active_date?: string | null;
};

type AuthContextValue = {
  user: SessionUser | null;
  streak: Streak | null;
  unreadNotifications: number;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (fullName: string, email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshSummary: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthResponse = {
  access_token: string;
  refresh_token: string;
  user: SessionUser;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshSummary = useCallback(async () => {
    if (!tokenStore.access()) return;
    try {
      const data = await api<{ user: SessionUser; streak: Streak; unread_notifications: number }>('/auth/me');
      setUser(data.user);
      setStreak(data.streak);
      setUnreadNotifications(Number(data.unread_notifications || 0));
    } catch {
      tokenStore.clear();
      setUser(null);
      setStreak(null);
      setUnreadNotifications(0);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      if (!tokenStore.access()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api<{ user: SessionUser; streak: Streak; unread_notifications: number }>('/auth/me');
        if (mounted) {
          setUser(data.user);
          setStreak(data.streak);
          setUnreadNotifications(Number(data.unread_notifications || 0));
        }
      } catch {
        tokenStore.clear();
      } finally {
        if (mounted) setLoading(false);
      }
    };
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setStreak(null);
      setUnreadNotifications(0);
    };
    window.addEventListener('vertexon:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('vertexon:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      tokenStore.set(data.access_token, data.refresh_token);
      setUser(data.user);
      setLoading(false);
      await refreshSummary();
      return data.user;
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }, [refreshSummary]);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    try {
      const data = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      tokenStore.set(data.access_token, data.refresh_token);
      setUser(data.user);
      setLoading(false);
      return data.user;
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh();
    try {
      if (refreshToken) await apiPost('/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Logging out locally is more important than a best-effort token revocation.
    }
    tokenStore.clear();
    setUser(null);
    setStreak(null);
    setUnreadNotifications(0);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      streak,
      unreadNotifications,
      loading,
      login,
      register,
      logout,
      refreshSummary,
    }),
    [user, streak, unreadNotifications, loading, login, register, logout, refreshSummary],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function roleLabel(role: Role) {
  if (role === 'instructor') return 'Instructor';
  if (role === 'admin') return 'Administrator';
  return 'Student';
}

export { homeForRole };
