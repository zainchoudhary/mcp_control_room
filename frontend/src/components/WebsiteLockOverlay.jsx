import { useState, useCallback, useEffect, useRef } from 'react'
import { Lock, Delete, Loader2 } from 'lucide-react'
import { verifyLockPin } from '../api.js'
import { markUnlocked } from '../utils/websiteLock.js'
import styles from './WebsiteLockOverlay.module.css'

export function WebsiteLockOverlay({ user, security, onUnlocked }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const inputRef = useRef(null)

  const pinEnabled = security?.lock_pin_set

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const tryUnlockPin = useCallback(async (value) => {
    if (!value || value.length < 4) return
    setVerifying(true)
    setError('')
    try {
      await verifyLockPin(value)
      markUnlocked(user.id)
      onUnlocked?.()
    } catch (err) {
      setError(err.message || 'Incorrect PIN')
      setPin('')
      inputRef.current?.focus()
    } finally {
      setVerifying(false)
    }
  }, [user?.id, onUnlocked])

  const handleDigit = (d) => {
    if (verifying || pin.length >= 8) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length >= 4) tryUnlockPin(next)
  }

  const handleBackspace = () => {
    if (verifying) return
    setPin((p) => p.slice(0, -1))
    setError('')
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key)
      else if (e.key === 'Backspace') handleBackspace()
      else if (e.key === 'Enter' && pin.length >= 4) tryUnlockPin(pin)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pin, verifying, tryUnlockPin])

  if (!pinEnabled) return null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Unlock ToolChain">
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <Lock size={28} />
        </div>
        <h2 className={styles.title}>ToolChain is locked</h2>
        <p className={styles.subtitle}>Enter your PIN to continue</p>

        <div className={styles.pinDots}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i < pin.length ? styles.dotFilled : ''}`}
            />
          ))}
        </div>
        <input
          ref={inputRef}
          className={styles.hiddenInput}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          readOnly
          aria-hidden
        />
        <div className={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" className={styles.key} onClick={() => handleDigit(String(n))} disabled={verifying}>
              {n}
            </button>
          ))}
          <span className={styles.keySpacer} />
          <button type="button" className={styles.key} onClick={() => handleDigit('0')} disabled={verifying}>0</button>
          <button type="button" className={styles.key} onClick={handleBackspace} disabled={verifying} aria-label="Delete">
            <Delete size={18} />
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {verifying && <p className={styles.hint}>Verifying…</p>}
      </div>
    </div>
  )
}
