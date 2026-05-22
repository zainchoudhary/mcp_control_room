import { registerAccountDevice } from '../api.js'
import { updateToken } from '../auth.js'
import { getClientDeviceId, parseDeviceLabel } from './deviceId.js'

export async function registerCurrentDevice(userId) {
  if (!userId) return null
  const clientDeviceId = getClientDeviceId(userId)
  if (!clientDeviceId) return null
  try {
    const data = await registerAccountDevice({
      client_device_id: clientDeviceId,
      label: parseDeviceLabel(),
      user_agent: navigator.userAgent.slice(0, 500),
    })
    if (data?.access_token) {
      updateToken(data.access_token)
    }
    return data
  } catch {
    return null
  }
}
