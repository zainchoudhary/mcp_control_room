const BASE = '/api/auth'
const TOKEN_KEY = 'toolchain_token'
const USER_KEY = 'toolchain_user'
const ACCOUNTS_KEY = 'toolchain_accounts'
const ADD_ACCOUNT_KEY = 'toolchain_adding_account'
const ADD_ACCOUNT_RETURN_KEY = 'toolchain_add_account_return'

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function readAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
}

function slimUser(user) {
  if (!user) return null
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    plan: user.plan || 'free',
  }
}

function upsertAccount(token, user) {
  if (!token || !user?.id) return
  const others = readAccounts().filter((a) => a.userId !== user.id)
  writeAccounts([
    {
      userId: user.id,
      token,
      user: slimUser(user),
      lastUsed: Date.now(),
    },
    ...others,
  ])
}

function migrateAccountsIfNeeded() {
  if (readAccounts().length > 0) return
  const token = getToken()
  const user = getSavedUser()
  if (token && user?.id) upsertAccount(token, user)
}

function getSavedAccounts() {
  migrateAccountsIfNeeded()
  return readAccounts().slice().sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
}

function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  upsertAccount(token, user)
}

function updateToken(token) {
  if (!token) return
  localStorage.setItem(TOKEN_KEY, token)
  const user = getSavedUser()
  if (user?.id) upsertAccount(token, user)
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

function updateSavedUser(user) {
  if (!user) return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  const token = getToken()
  if (token) upsertAccount(token, user)
}

function switchAccount(userId) {
  const list = readAccounts()
  const target = list.find((a) => a.userId === userId)
  if (!target?.token) return false
  writeAccounts([
    { ...target, lastUsed: Date.now() },
    ...list.filter((a) => a.userId !== userId),
  ])
  localStorage.setItem(TOKEN_KEY, target.token)
  localStorage.setItem(USER_KEY, JSON.stringify(target.user))
  return true
}

/** Remove only the active account. If others remain, activates the most recent. */
function logoutCurrent() {
  const current = getSavedUser()
  clearAuth()
  if (!current?.id) {
    return { next: null }
  }
  const remaining = readAccounts()
    .filter((a) => a.userId !== current.id)
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
  writeAccounts(remaining)
  if (remaining.length === 0) {
    return { next: null }
  }
  const pick = remaining[0]
  localStorage.setItem(TOKEN_KEY, pick.token)
  localStorage.setItem(USER_KEY, JSON.stringify(pick.user))
  return { next: pick.user }
}

function logoutAll() {
  clearAuth()
  localStorage.removeItem(ACCOUNTS_KEY)
  clearAddingAccount()
}

/** Backward-compatible: sign out of the current account only. */
function logout() {
  return logoutCurrent()
}

function isAddingAccount() {
  try {
    return sessionStorage.getItem(ADD_ACCOUNT_KEY) === '1'
  } catch {
    return false
  }
}

function beginAddingAccount(returnPage = 'dashboard') {
  try {
    sessionStorage.setItem(ADD_ACCOUNT_KEY, '1')
    sessionStorage.setItem(ADD_ACCOUNT_RETURN_KEY, returnPage || 'dashboard')
  } catch {
    /* ignore */
  }
}

function getAddAccountReturnPage() {
  try {
    return sessionStorage.getItem(ADD_ACCOUNT_RETURN_KEY) || 'dashboard'
  } catch {
    return 'dashboard'
  }
}

function clearAddingAccount() {
  try {
    sessionStorage.removeItem(ADD_ACCOUNT_KEY)
    sessionStorage.removeItem(ADD_ACCOUNT_RETURN_KEY)
  } catch {
    /* ignore */
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
  return data
}

async function login({ email, password, persist = true }) {
  const data = await authRequest('/login', { email, password })
  if (data.requires_2fa) {
    return data
  }
  if (persist) {
    setAuth(data.access_token, data.user)
    clearAddingAccount()
  }
  return data
}

async function verifyLogin2fa({ pending_token, code, persist = true }) {
  const data = await authRequest('/login/verify-2fa', { pending_token, code })
  if (persist) {
    setAuth(data.access_token, data.user)
    clearAddingAccount()
  }
  return data
}

function acceptAuth(token, user) {
  setAuth(token, user)
  clearAddingAccount()
}

function isAccountAlreadySaved(userId) {
  if (!userId) return false
  return getSavedAccounts().some((a) => a.userId === userId)
}

async function forgotPassword(email) {
  const res = await fetch(`${BASE}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function resetPassword(token, password, confirm_password) {
  const res = await fetch(`${BASE}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, confirm_password }),
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

async function fetchMe() {
  const token = getToken()
  if (!token) return null
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = err.detail
    // Only drop the session on real auth failures — not network/5xx blips
    if (res.status === 401) {
      const { next } = logoutCurrent()
      if (next) {
        window.location.replace('/dashboard')
      } else if (!window.location.pathname.includes('login')) {
        window.location.replace('/login')
      }
    }
    return null
  }
  const user = await res.json()
  updateSavedUser(user)
  return user
}

export {
  getToken,
  getSavedUser,
  getSavedAccounts,
  switchAccount,
  logoutCurrent,
  logoutAll,
  signup,
  login,
  verifyLogin2fa,
  acceptAuth,
  isAccountAlreadySaved,
  logout,
  fetchMe,
  forgotPassword,
  resetPassword,
  updateToken,
  updateSavedUser,
  isAddingAccount,
  beginAddingAccount,
  clearAddingAccount,
  getAddAccountReturnPage,
}
