import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, apiDelete, apiPut, errorMessage } from '../lib/api';

type Person = {
  id: string;
  full_name: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  headline?: string;
  created_at: string;
  current_streak: number | null;
  last_active_date: string | null;
  enrollment_count: number;
  course_count: number;
};

const roleOptions = [
  { value: '', label: 'All roles' },
  { value: 'student', label: 'Students' },
  { value: 'instructor', label: 'Instructors' },
  { value: 'admin', label: 'Admins' },
];

export default function AdminUsers() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (role) params.set('role', role);
      if (status) params.set('status', status);
      const data = await api<{ users: Person[] }>(`/admin/users?${params.toString()}`);
      setPeople(data.users);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
  }, [query, role, status]);

  const updateRole = async (person: Person, nextRole: string) => {
    setBusy(`role-${person.id}`);
    try {
      await apiPut(`/admin/users/${person.id}/role`, { role: nextRole });
      setPeople((current) => current.map((item) => (item.id === person.id ? { ...item, role: nextRole as Person['role'] } : item)));
      showToast(`${person.full_name} is now ${nextRole}.`);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const toggleSuspension = async (person: Person) => {
    const suspended = person.status === 'active';
    if (suspended && !window.confirm(`Suspend ${person.full_name}? Their refresh tokens will be revoked.`)) return;
    setBusy(`status-${person.id}`);
    try {
      await apiPut(`/admin/users/${person.id}/suspend`, { suspended });
      setPeople((current) => current.map((item) => (item.id === person.id ? { ...item, status: suspended ? 'suspended' : 'active' } : item)));
      showToast(`${person.full_name} ${suspended ? 'suspended' : 'reactivated'}.`);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const deletePerson = async (person: Person) => {
    if (
      !window.confirm(
        `Delete ${person.full_name}? The account is anonymized, sessions are revoked, and personal learning notes are removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(`delete-${person.id}`);
    try {
      await apiDelete(`/admin/users/${person.id}`);
      setPeople((current) =>
        current.map((item) =>
          item.id === person.id
            ? { ...item, full_name: 'Deleted user', email: `deleted-${item.id}@vertexon.invalid`, status: 'deleted' }
            : item,
        ),
      );
      showToast(`${person.full_name} deleted and anonymized.`);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <button onClick={() => navigate('/admin')} className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-white/30 transition hover:text-white/65"><ArrowLeft className="h-3 w-3" /> Admin overview</button>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-300/75">Access control</p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">Users &amp; roles.</h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-white/35">Assign platform roles, investigate activity, and suspend accounts when necessary.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <Users className="h-4 w-4 text-primary-300" />
          <div><p className="text-[8px] uppercase tracking-[0.12em] text-white/25">Matching users</p><p className="mt-0.5 font-display text-[16px] font-semibold text-white/85">{people.length}</p></div>
          <span className="h-7 w-px bg-white/[0.07]" />
          <div><p className="text-[8px] uppercase tracking-[0.12em] text-white/25">Suspended</p><p className="mt-0.5 font-display text-[16px] font-semibold text-white/85">{people.filter((person) => person.status === 'suspended').length}</p></div>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex h-10 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-[#100d19] px-3.5 sm:max-w-md">
          <Search className="h-4 w-4 shrink-0 text-white/25" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email..." className="h-full min-w-0 flex-1 bg-transparent text-[11.5px] text-white/75 placeholder:text-white/20 focus:outline-none" aria-label="Search users" />
        </div>
        <select value={role} onChange={(event) => setRole(event.target.value)} className="form-input h-10 w-full sm:w-[160px]" aria-label="Filter by role">
          {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="form-input h-10 w-full sm:w-[150px]" aria-label="Filter by status">
          <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deleted">Deleted</option>
        </select>
        <button onClick={load} className="btn-ghost h-10 px-3 text-[10.5px]"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19]">
        <div className="hidden grid-cols-[minmax(220px,1.4fr)_140px_120px_110px_120px_170px] gap-3 border-b border-white/[0.055] px-5 py-3 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/22 lg:grid">
          <span>User</span><span>Role</span><span>Status</span><span>Enrollments</span><span>Last active</span><span className="text-right">Actions</span>
        </div>
        {loading && people.length === 0 ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary-300/60" /></div>
        ) : people.length === 0 ? (
          <div className="py-16 text-center"><Users className="mx-auto h-6 w-6 text-white/20" /><p className="mt-2 text-[11px] text-white/40">No users match these filters.</p></div>
        ) : (
          <div className="divide-y divide-white/[0.045]">
            {people.map((person) => {
              const self = currentUser?.id === person.id;
              return (
                <div key={person.id} className="grid gap-3 px-4 py-3.5 transition hover:bg-white/[0.015] sm:px-5 lg:grid-cols-[minmax(220px,1.4fr)_140px_120px_110px_120px_170px] lg:items-center">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={person.full_name} size={30} online={person.status === 'active'} />
                    <div className="min-w-0"><p className="truncate text-[11px] font-semibold text-white/70">{person.full_name}{self && <span className="ml-1.5 text-[8px] font-normal text-primary-300/60">you</span>}</p><p className="truncate text-[8.5px] text-white/25">{person.email}</p></div>
                  </div>
                  <div>
                    <select value={person.role} onChange={(event) => updateRole(person, event.target.value)} disabled={self || person.status === 'deleted' || busy === `role-${person.id}`} className="form-input h-8 w-full max-w-[125px] text-[9px] disabled:opacity-50" aria-label={`Role for ${person.full_name}`}>
                      <option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option>
                    </select>
                  </div>
                  <div><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[7.5px] font-semibold uppercase tracking-wide ${person.status === 'active' ? 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300' : person.status === 'deleted' ? 'border-white/10 bg-white/[0.04] text-white/35' : 'border-rose-400/15 bg-rose-400/[0.07] text-rose-300'}`}>{person.status === 'active' ? <CheckCircle2 className="h-2.5 w-2.5" /> : person.status === 'deleted' ? <Trash2 className="h-2.5 w-2.5" /> : <ShieldOff className="h-2.5 w-2.5" />}{person.status}</span></div>
                  <div className="text-[9px] text-white/35"><span className="lg:hidden">Enrollments: </span>{person.enrollment_count}{person.course_count > 0 && <span className="block text-[8px] text-white/20">{person.course_count} courses taught</span>}</div>
                  <div className="text-[9px] text-white/35"><span className="lg:hidden">Last active: </span>{person.last_active_date || '—'}</div>
                  <div className="flex flex-wrap items-center justify-start gap-1.5 lg:justify-end">
                    <button onClick={() => toggleSuspension(person)} disabled={self || person.status === 'deleted' || busy === `status-${person.id}`} className={`flex items-center gap-1 rounded-lg border px-2.5 py-2 text-[8.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${person.status === 'active' ? 'border-rose-400/15 bg-rose-400/[0.05] text-rose-200 hover:bg-rose-400/[0.1]' : 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200 hover:bg-emerald-400/[0.12]'}`}>
                      {busy === `status-${person.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : person.status === 'active' ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                      {person.status === 'active' ? 'Suspend' : person.status === 'deleted' ? 'Deleted' : 'Reactivate'}
                    </button>
                    <button onClick={() => deletePerson(person)} disabled={self || person.status === 'deleted' || busy === `delete-${person.id}`} title="Delete and anonymize account" className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-[8.5px] font-medium text-white/35 transition hover:border-rose-400/20 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-30">
                      {busy === `delete-${person.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
        <UserCog className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-300/45" />
        <p className="text-[8.5px] leading-relaxed text-white/25">Role changes are audited. You cannot change your own admin role or suspend your own account. Suspension immediately revokes refresh tokens.</p>
      </div>
    </div>
  );
}
