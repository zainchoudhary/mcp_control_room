import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_PREFIX = 'toolchain_theme_'

function systemTheme() {
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

function getUserTheme(userId) {
  if (!userId) return systemTheme()
  const stored = localStorage.getItem(STORAGE_PREFIX + userId)
  if (stored === 'light' || stored === 'dark') return stored
  return systemTheme()
}

export function useTheme(userId) {
  const [theme, setTheme] = useState(() => getUserTheme(userId))
  const prevUserId = useRef(userId)

  useEffect(() => {
    if (prevUserId.current !== userId) {
      prevUserId.current = userId
      setTheme(getUserTheme(userId))
    }
  }, [userId])

  useEffect(() => {
    if (userId) {
      localStorage.setItem(STORAGE_PREFIX + userId, theme)
    }
  }, [theme, userId])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
