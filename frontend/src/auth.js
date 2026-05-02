const BASE = '/api/auth'
const TOKEN_KEY = 'toolchain_token'
const USER_KEY = 'toolchain_user'

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function getSavedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function authRequest(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = err.detail
    if (Array.isArray(detail)) {
      const msg = detail.map((d) => d.msg?.replace('Value error, ', '') || d.msg || '').join('\n')
      throw new Error(msg)
    }
    throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`)
  }
  return res.json()
}

async function signup({ username, email, password, confirm_password, full_name }) {
  const data = await authRequest('/signup', { username, email, password, confirm_password, full_name })
  setAuth(data.access_token, data.user)
  return data
}

async function login({ email, password }) {
  const data = await authRequest('/login', { email, password })
  setAuth(data.access_token, data.user)
  return data
}

function logout() {
  clearAuth()
}

async function fetchMe() {
  const token = getToken()
  if (!token) return null
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    clearAuth()
    return null
  }
  const user = await res.json()
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

export { getToken, getSavedUser, signup, login, logout, fetchMe }
