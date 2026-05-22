const DEVICE_PREFIX = 'toolchain_client_device_'

export function getClientDeviceId(userId) {
  if (!userId) return null
  const key = DEVICE_PREFIX + userId
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export function clearClientDeviceId(userId) {
  if (!userId) return
  localStorage.removeItem(DEVICE_PREFIX + userId)
}

export function parseDeviceLabel() {
  const ua = navigator.userAgent
  let browser = 'Browser'
  let os = 'Unknown OS'

  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'

  if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  return `${browser} on ${os}`
}
