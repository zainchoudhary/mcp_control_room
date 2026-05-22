import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_PREFIX = 'toolchain_preferences_'

const DEFAULTS = {
  sidebarCollapsedDefault: false,
  animationsEnabled: true,
  startupPage: 'dashboard',
  customBg: '',
}

const STARTUP_PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'chat', label: 'Chat' },
  { id: 'mcp-servers', label: 'MCP Servers' },
  { id: 'tool-execution', label: 'Tool Execution' },
]

function loadPrefs(userId) {
  if (!userId) return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

function savePrefs(userId, prefs) {
  if (!userId) return
  localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(prefs))
}

export { STARTUP_PAGES }

const STARTUP_PAGE_IDS = new Set(STARTUP_PAGES.map((p) => p.id))

/** Read saved startup page for a user (sync; safe during login before React state updates). */
export function getStartupPage(userId) {
  const page = loadPrefs(userId).startupPage || 'dashboard'
  return STARTUP_PAGE_IDS.has(page) ? page : 'dashboard'
}

export function usePreferences(userId) {
  const [prefs, setPrefs] = useState(() => loadPrefs(userId))
  const prevUserId = useRef(userId)

  useEffect(() => {
    if (prevUserId.current !== userId) {
      prevUserId.current = userId
      setPrefs(loadPrefs(userId))
    }
  }, [userId])

  const setPref = useCallback((key, value) => {
    if (!userId) return
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      savePrefs(userId, next)
      return next
    })
  }, [userId])

  const togglePref = useCallback((key) => {
    if (!userId) return
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      savePrefs(userId, next)
      return next
    })
  }, [userId])

  return { prefs, setPref, togglePref }
}
