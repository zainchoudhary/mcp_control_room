import { getToken, logout } from './auth.js'

const BASE = '/api'

function authHeaders() {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function handleSessionRevoked(detail) {
  const msg = typeof detail === 'string' ? detail : ''
  if (!msg.toLowerCase().includes('device was removed')) return false
  logout()
  if (!window.location.pathname.includes('login')) {
    window.location.replace('/login')
  }
  return true
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...authHeaders(), ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = err.detail
    if (res.status === 401 && handleSessionRevoked(detail)) {
      throw new Error('Session ended on this device.')
    }
    throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// MCPs
export const listMCPs = () => request('/mcps')
export const getMCP = (id) => request(`/mcps/${id}`)
export const registerMCP = (body) => request('/mcps', { method: 'POST', body: JSON.stringify(body) })
export const deleteMCP = (id) => request(`/mcps/${id}`, { method: 'DELETE' })
export const connectMCP = (id, { skipAuth = false } = {}) => request(`/mcps/${id}/connect${skipAuth ? '?skip_auth=true' : ''}`, { method: 'POST' })
export const disconnectMCP = (id) => request(`/mcps/${id}/disconnect`, { method: 'POST' })
export const toggleMCP = (id) => request(`/mcps/${id}/toggle`, { method: 'POST' })
export const probeMCP = (id) => request(`/mcps/${id}/probe`, { method: 'POST' })
export const executeTool = (mcpId, toolName, args = {}) =>
  request(`/mcps/${mcpId}/tools/${encodeURIComponent(toolName)}/execute`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  })
export const getMCPAuthStatus = (id) => request(`/mcps/${id}/auth/status`)
export const getMCPAuthUrl = (id) => request(`/mcps/${id}/auth/url`)
export const revokeMCPAuth = (id) => request(`/mcps/${id}/auth/revoke`, { method: 'POST' })

// Stats
export const getWeeklyStats = () => request('/stats/weekly')

// Sessions
export const listSessions = () => request('/sessions')
export const createSession = () => request('/sessions', { method: 'POST' })
export const createGhostSession = () => request('/sessions/ghost', { method: 'POST' })
export const updateSession = (id, body) => request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteSessionApi = (id) => request(`/sessions/${id}`, { method: 'DELETE' })
export const getMessages = (id) => request(`/sessions/${id}/messages`)

// Account
export const changePassword = (currentPassword, newPassword, confirmPassword) =>
  request('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }),
  })
export const changeUsername = (newUsername) =>
  request('/auth/username', {
    method: 'PUT',
    body: JSON.stringify({ new_username: newUsername }),
  })
export const deleteAccount = (password) =>
  request('/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  })

export const checkUsernameAvailability = (username) =>
  request(`/auth/username/check?username=${encodeURIComponent(username)}`)

export const listAccountDevices = () => request('/auth/account/devices')

export const registerAccountDevice = (body) =>
  request('/auth/account/devices', { method: 'POST', body: JSON.stringify(body) })

export const removeAccountDevice = (deviceId) =>
  request(`/auth/account/devices/${deviceId}`, { method: 'DELETE' })

// Security
export const getSecuritySettings = () => request('/auth/security')

export const setRecoveryEmail = (recoveryEmail, password) =>
  request('/auth/security/recovery-email', {
    method: 'PUT',
    body: JSON.stringify({ recovery_email: recoveryEmail, password }),
  })

export const removeRecoveryEmail = (password) =>
  request('/auth/security/recovery-email', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  })

export const setup2fa = () => request('/auth/security/2fa/setup', { method: 'POST' })

export const enable2fa = (code, password) =>
  request('/auth/security/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ code, password }),
  })

export const disable2fa = (code, password) =>
  request('/auth/security/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ code, password }),
  })

export const setLockPin = (pin, password) =>
  request('/auth/security/lock-pin', {
    method: 'PUT',
    body: JSON.stringify({ pin, password }),
  })

export const removeLockPin = (password) =>
  request('/auth/security/lock-pin', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  })

export const verifyLockPin = (pin) =>
  request('/auth/security/lock-pin/verify', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })

// Bulk session actions
export const deleteAllSessions = () => request('/sessions', { method: 'DELETE' })
export const exportAllChats = async () => {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/sessions/export`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'toolchain_chats_export.docx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Chat attachments
export const listChatAttachments = (sessionId) =>
  request(`/sessions/${sessionId}/attachments`)

export async function uploadChatAttachment(sessionId, file) {
  const token = getToken()
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${BASE}/sessions/${sessionId}/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = err.detail
    throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`)
  }
  return res.json()
}

export const deleteChatAttachment = (sessionId, attachmentId) =>
  request(`/sessions/${sessionId}/attachments/${attachmentId}`, { method: 'DELETE' })

export async function fetchAttachmentBlob(sessionId, attachmentId) {
  const token = getToken()
  const res = await fetch(
    `${BASE}/sessions/${sessionId}/attachments/${attachmentId}/file`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  )
  if (!res.ok) throw new Error('Failed to load file')
  return res.blob()
}

// Chat Stream
export async function* streamChat(sessionId, message, mcpIds = [], attachmentIds = [], { ghostMode = false, ghostHistory = null } = {}) {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      session_id: sessionId,
      message,
      mcp_ids: mcpIds,
      attachment_ids: attachmentIds.length ? attachmentIds : undefined,
      ghost_mode: ghostMode || undefined,
      ghost_history: ghostHistory?.length ? ghostHistory : undefined,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.startsWith('data: ')) continue
      try {
        yield JSON.parse(part.slice(6))
      } catch {
        // skip malformed
      }
    }
  }
}

// Billing / Subscription
export const getPlans = () => request('/billing/plans')
export const getSubscription = () => request('/billing/subscription')
export const getUsage = () => request('/billing/usage')
export const createCheckout = (plan) => request('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) })
export const createPortalSession = () => request('/billing/portal', { method: 'POST' })
export const getInvoices = () => request('/billing/invoices')

// Contact form (public, no auth)
export const submitContact = (data) =>
  fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(async (res) => {
    const json = await res.json()
    if (!res.ok) throw new Error(json.detail || 'Failed to send message')
    return json
  })
