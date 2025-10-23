// Small frontend app utilities (auth helpers) to keep code modular
// For the university practice we keep it simple: store auth in sessionStorage
// so each tab/window has its own session and tokens don't overwrite each other.

export function getToken() {
  return sessionStorage.getItem('accessToken') || null
}

export function getPublicUser() {
  try { return JSON.parse(sessionStorage.getItem('publicUser') || 'null') } catch(e) { return null }
}

export function requireAuthOrRedirect() {
  const token = getToken()
  if (!token) {
    window.location = '/login'
    throw new Error('Not authenticated')
  }
  return token
}

export function saveAuth(token, publicUser) {
  sessionStorage.setItem('accessToken', token)
  sessionStorage.setItem('publicUser', JSON.stringify(publicUser))
}

export function clearAuth() {
  sessionStorage.removeItem('accessToken')
  sessionStorage.removeItem('publicUser')
}

// Simple helper to fetch JSON with token
export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = options.headers || {}
  headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { ...options, headers })
  return res
}
// end of module
