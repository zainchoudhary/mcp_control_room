import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_PREFIX = 'toolchain_accent_'
const DEFAULT_HEX = '#10a37f'

export const ACCENT_COLORS = [
  { id: 'default', label: 'Default', hex: DEFAULT_HEX },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
]

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function darken(hex, amount = 0.15) {
  const { r, g, b } = hexToRgb(hex)
  const f = 1 - amount
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`
}

function applyAccent(hex) {
  const root = document.documentElement
  const { r, g, b } = hexToRgb(hex)
  const rgb = `${r}, ${g}, ${b}`
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent-hover', darken(hex, 0.15))
  root.style.setProperty('--accent-light', `rgba(${rgb}, 0.12)`)
  root.style.setProperty('--accent-border', `rgba(${rgb}, 0.3)`)
  root.style.setProperty('--accent-rgb', rgb)
  root.style.setProperty('--selection-bg', `rgba(${rgb}, 0.25)`)
  root.style.setProperty('--green', hex)
  root.style.setProperty('--green-light', `rgba(${rgb}, 0.12)`)
}

function getUserAccent(userId) {
  if (!userId) return 'default'
  const stored = localStorage.getItem(STORAGE_PREFIX + userId)
  const found = ACCENT_COLORS.find((c) => c.id === stored)
  return found ? found.id : 'default'
}

export function useAccentColor(userId) {
  const [accentId, setAccentIdState] = useState(() => getUserAccent(userId))
  const prevUserId = useRef(userId)

  useEffect(() => {
    if (prevUserId.current !== userId) {
      prevUserId.current = userId
      const userAccent = getUserAccent(userId)
      setAccentIdState(userAccent)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      applyAccent(DEFAULT_HEX)
      return
    }
    const color = ACCENT_COLORS.find((c) => c.id === accentId) || ACCENT_COLORS[0]
    applyAccent(color.hex)
  }, [accentId, userId])

  const setAccentColor = useCallback((id) => {
    setAccentIdState(id)
    if (userId) {
      localStorage.setItem(STORAGE_PREFIX + userId, id)
    }
  }, [userId])

  return { accentId, setAccentColor }
}
