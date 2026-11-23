import type {
  AirAlertDetail,
  AirAlertDetails,
  AirAlertLevel,
  AirAlertThreat,
  AirAlertType,
} from '../model/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

function isAlertType(value: unknown): value is AirAlertType {
  return value === 'air_raid' || value === 'artillery_shelling'
}

function isAlertLevel(value: unknown): value is AirAlertLevel {
  return value === null || value === 'red' || value === 'yellow'
}

function isThreat(value: unknown): value is AirAlertThreat {
  return isRecord(value) &&
    typeof value.threatType === 'string' &&
    value.threatType.length > 0 &&
    isAlertLevel(value.level) &&
    (value.startedAt === null || isIsoTimestamp(value.startedAt)) &&
    (value.sourceMessage === null || typeof value.sourceMessage === 'string')
}

function isAlertDetail(value: unknown): value is AirAlertDetail {
  if (!isRecord(value) || !isAlertType(value.alertType) || !isAlertLevel(value.alertLevel)) return false
  if (!isIsoTimestamp(value.startedAt)) return false
  if (value.finishedAt !== null && !isIsoTimestamp(value.finishedAt)) return false
  if (value.finishedAt !== null && Date.parse(value.finishedAt) < Date.parse(value.startedAt)) return false
  return Array.isArray(value.threats) && value.threats.every(isThreat)
}

function isAirAlertDetails(value: unknown): value is AirAlertDetails {
  return isRecord(value) && Array.isArray(value.alerts) && value.alerts.every(isAlertDetail)
}

export async function getAirAlertDetails(signal: AbortSignal): Promise<AirAlertDetails> {
  const response = await fetch('/api/alert-details', { method: 'GET', signal })
  if (!response.ok) throw new Error('Air alert details request failed')
  const payload: unknown = await response.json()
  if (!isAirAlertDetails(payload)) throw new Error('Air alert details response is invalid')
  return payload
}
