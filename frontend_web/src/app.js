// Small frontend app utilities (auth helpers) to keep code modular
export function getToken() {
  return localStorage.getItem('accessToken') || null;
}

export function getPublicUser() {
  try { return JSON.parse(localStorage.getItem('publicUser')||'null'); } catch(e){ return null; }
}

export function requireAuthOrRedirect() {
  const token = getToken();
  if (!token) {
    window.location = 'index.html';
    throw new Error('Not authenticated');
  }
  return token;
}

export function saveAuth(token, publicUser) {
  localStorage.setItem('accessToken', token);
  localStorage.setItem('publicUser', JSON.stringify(publicUser));
}

export function clearAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('publicUser');
}

// Simple helper to fetch JSON with token
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = options.headers || {};
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  return res;
}
