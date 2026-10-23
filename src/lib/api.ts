export type Role = 'student' | 'instructor' | 'admin';

export type SessionUser = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: 'active' | 'suspended';
  headline?: string | null;
  avatar_url?: string | null;
  created_at?: string;
};

export type ApiError = Error & {
  status: number;
  code?: string;
  field?: string;
};

const API_BASE = '/api/v1';
const ACCESS_KEY = 'vertexon.access_token';
const REFRESH_KEY = 'vertexon.refresh_token';

export const tokenStore = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export function homeForRole(role: Role) {
  if (role === 'instructor') return '/instructor';
  if (role === 'admin') return '/admin';
  return '/';
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function makeError(response: Response, data: unknown): ApiError {
  const payload =
    data && typeof data === 'object' && 'error' in data
      ? (data as { error: { code?: string; message?: string; field?: string } }).error
      : null;
  const error = new Error(payload?.message || `Request failed with status ${response.status}.`) as ApiError;
  error.status = response.status;
  error.code = payload?.code;
  error.field = payload?.field;
  return error;
}

async function refreshSession() {
  const refreshToken = tokenStore.refresh();
  if (!refreshToken) return false;
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  tokenStore.set(data.access_token, data.refresh_token);
  return true;
}

async function request<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const accessToken = tokenStore.access();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    const error = new Error('The API server is not reachable. Start it with `npm run dev`.') as ApiError;
    error.status = 0;
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  if (response.status === 401 && allowRefresh && !path.startsWith('/auth/')) {
    if (await refreshSession()) return request<T>(path, options, false);
    tokenStore.clear();
    window.dispatchEvent(new Event('vertexon:unauthorized'));
  }

  const data = await parseResponse(response);
  if (!response.ok) throw makeError(response, data);
  return data as T;
}

export function api<T>(path: string, options: RequestInit = {}) {
  return request<T>(path, options);
}

export function apiPost<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiPut<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string) {
  return api<T>(path, { method: 'DELETE' });
}

export function apiUpload<T>(path: string, formData: FormData) {
  return api<T>(path, { method: 'POST', body: formData });
}

export async function downloadApi(path: string, filename: string) {
  const accessToken = tokenStore.access();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) {
    const data = await parseResponse(response);
    throw makeError(response, data);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
