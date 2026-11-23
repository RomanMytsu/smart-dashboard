import type { AirAlertHistory, AirAlertHistoryEvent } from '../model/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

function isHistoryEvent(value: unknown): value is AirAlertHistoryEvent {
  if (!isRecord(value) ||
    (value.alertType !== 'air_raid' && value.alertType !== 'artillery_shelling') ||
    !isIsoTimestamp(value.startedAt)) return false
  if (value.finishedAt !== null && !isIsoTimestamp(value.finishedAt)) return false
  return value.finishedAt === null || Date.parse(value.finishedAt) >= Date.parse(value.startedAt)
}

function isAirAlertHistory(value: unknown): value is AirAlertHistory {
  return isRecord(value) && Array.isArray(value.events) && value.events.every(isHistoryEvent)
}

export async function getAirAlertHistory(signal: AbortSignal): Promise<AirAlertHistory> {
  const response = await fetch('/api/alert-history', { method: 'GET', signal })
  if (!response.ok) throw new Error('Air alert history request failed')
  const payload: unknown = await response.json()
  if (!isAirAlertHistory(payload)) throw new Error('Air alert history response is invalid')
  return payload
}
