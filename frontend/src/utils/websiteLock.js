const UNLOCK_SESSION_PREFIX = 'toolchain_unlocked_session_'

export function shouldShowLock(userId, security) {
  if (!userId) return false
  if (!security?.lock_pin_set) return false
  return sessionStorage.getItem(UNLOCK_SESSION_PREFIX + userId) !== '1'
}

export function markUnlocked(userId) {
  if (!userId) return
  sessionStorage.setItem(UNLOCK_SESSION_PREFIX + userId, '1')
}

export function clearUnlockSession(userId) {
  if (!userId) return
  sessionStorage.removeItem(UNLOCK_SESSION_PREFIX + userId)
}

export function lockSession(userId) {
  clearUnlockSession(userId)
}
