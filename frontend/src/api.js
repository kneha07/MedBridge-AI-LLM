// Shared fetch helper. When the server has sign-in turned on, the token is sent with every request.
export const API = 'http://localhost:8000';

const KEY = 'medbridge_session';
let session = null; // { token, name, role }

try { session = JSON.parse(sessionStorage.getItem(KEY)); } catch { session = null; }

export const getSession = () => session;

export function setSession(s) {
  session = s;
  try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch { /* storage blocked: stay signed in for this page only */ }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401 && session) onUnauthorized(); // token expired or server restarted with new users
  return res;
}
