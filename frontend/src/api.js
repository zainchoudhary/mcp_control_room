import { getToken } from './auth.js'

const BASE = '/api'

function authHeaders() {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...authHeaders(), ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// MCPs
export const listMCPs = () => request('/mcps')
export const getMCP = (id) => request(`/mcps/${id}`)
export const registerMCP = (body) => request('/mcps', { method: 'POST', body: JSON.stringify(body) })
export const deleteMCP = (id) => request(`/mcps/${id}`, { method: 'DELETE' })
export const connectMCP = (id) => request(`/mcps/${id}/connect`, { method: 'POST' })
export const disconnectMCP = (id) => request(`/mcps/${id}/disconnect`, { method: 'POST' })
export const probeMCP = (id) => request(`/mcps/${id}/probe`, { method: 'POST' })

// Sessions
export const listSessions = () => request('/sessions')
export const createSession = () => request('/sessions', { method: 'POST' })
export const updateSession = (id, body) => request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteSessionApi = (id) => request(`/sessions/${id}`, { method: 'DELETE' })
export const getMessages = (id) => request(`/sessions/${id}/messages`)

// Chat Stream
export async function* streamChat(sessionId, message) {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ session_id: sessionId, message }),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

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
