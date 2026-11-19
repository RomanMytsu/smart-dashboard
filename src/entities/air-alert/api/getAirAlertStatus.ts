import type { AirAlertData } from '../model/types'

function isAirAlertData(value: unknown): value is AirAlertData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    (candidate.status === 'active' &&
      (candidate.level === 'red' || candidate.level === 'yellow')) ||
    ((candidate.status === 'partial' || candidate.status === 'inactive') &&
      candidate.level === null)
  )
}

export async function getAirAlertStatus(
  signal: AbortSignal,
): Promise<AirAlertData> {
  const response = await fetch('/api/alerts', {
    method: 'GET',
    signal,
    cache: 'no-store',
  })

  if (!response.ok) throw new Error('Air alert request failed')

  const payload: unknown = await response.json()
  if (!isAirAlertData(payload)) throw new Error('Air alert response is invalid')

  return payload
}
