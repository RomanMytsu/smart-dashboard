import type {
  AirAlertDetail,
  AirAlertDetails,
  AirAlertLevel,
  AirAlertThreat,
  AirAlertType,
} from '../src/entities/air-alert/model/types.js'

const ALERTS_URL = 'https://api.alerts.in.ua/v1/alerts/active.json'
const ALERT_LOCATION_UID = '1293'
const ALERT_LOCATION_TYPE = 'hromada'
const UPSTREAM_TIMEOUT_MS = 10_000
const MAX_RESPONSE_LENGTH = 1_000_000
const CACHE_SECONDS = 60
const SOURCE_MESSAGE_MAX_LENGTH = 500

class AlertDetailsError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(code)
    this.name = 'AlertDetailsError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

function readLevel(value: unknown): AirAlertLevel {
  if (value === undefined || value === null) return null
  if (value === 'red' || value === 'yellow') return value
  throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
}

function readStartedAt(value: unknown, optional: true): string | null
function readStartedAt(value: unknown, optional?: false): string
function readStartedAt(value: unknown, optional = false): string | null {
  if (optional && (value === undefined || value === null)) return null
  if (!isIsoTimestamp(value)) throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  return value
}

function readFinishedAt(value: unknown): string | null {
  if (value === null) return null
  if (!isIsoTimestamp(value)) throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  return value
}

function parseThreat(value: unknown): AirAlertThreat {
  if (!isRecord(value) || typeof value.threat_type !== 'string' || value.threat_type.length === 0) {
    throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  }
  const sourceMessage = value.source_message
  if (sourceMessage !== undefined && sourceMessage !== null && typeof sourceMessage !== 'string') {
    throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  }
  return {
    threatType: value.threat_type,
    level: readLevel(value.level),
    startedAt: readStartedAt(value.started_at, true),
    sourceMessage: typeof sourceMessage === 'string'
      ? sourceMessage.trim().slice(0, SOURCE_MESSAGE_MAX_LENGTH) || null
      : null,
  }
}

function parseAlert(value: Record<string, unknown>): AirAlertDetail | null {
  const rawUid = value.location_uid
  if (typeof rawUid !== 'string' && typeof rawUid !== 'number') {
    throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  }
  if (
    String(rawUid) !== ALERT_LOCATION_UID ||
    value.location_type !== ALERT_LOCATION_TYPE
  ) return null

  const rawType = value.alert_type
  if (rawType !== 'air_raid' && rawType !== 'artillery_shelling') return null
  const alertType: AirAlertType = rawType
  const startedAt = readStartedAt(value.started_at)
  const finishedAt = readFinishedAt(value.finished_at)
  if (finishedAt !== null && Date.parse(finishedAt) < Date.parse(startedAt)) {
    throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  }
  const rawThreats = value.threats
  if (rawThreats !== undefined && !Array.isArray(rawThreats)) {
    throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  }
  return {
    alertType,
    alertLevel: readLevel(value.alert_level),
    startedAt,
    finishedAt,
    threats: Array.isArray(rawThreats) ? rawThreats.map(parseThreat) : [],
  }
}

function parseDetails(value: unknown): AirAlertDetails {
  if (!isRecord(value) || !Array.isArray(value.alerts)) {
    throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  }
  const alerts: AirAlertDetail[] = []
  for (const item of value.alerts) {
    if (!isRecord(item)) throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
    const alert = parseAlert(item)
    if (alert && alert.finishedAt === null) alerts.push(alert)
  }
  return { alerts }
}

function jsonResponse(payload: unknown, statusCode: number, cacheSuccess = false): Response {
  const headers: Record<string, string> = {
    'Cache-Control': cacheSuccess ? 'public, max-age=0, must-revalidate' : 'private, no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }
  if (cacheSuccess) {
    headers['Vercel-CDN-Cache-Control'] =
      `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30`
  }
  return new Response(JSON.stringify(payload), { status: statusCode, headers })
}

async function readDetails(signal: AbortSignal): Promise<AirAlertDetails> {
  const token = process.env.ALERTS_IN_UA_TOKEN
  if (!token) throw new AlertDetailsError(503, 'ALERT_DETAILS_NOT_CONFIGURED')

  let response: Response
  try {
    response = await fetch(ALERTS_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal,
      cache: 'no-store',
    })
  } catch {
    if (signal.aborted) throw new AlertDetailsError(504, 'ALERT_DETAILS_TIMEOUT')
    throw new AlertDetailsError(502, 'ALERT_DETAILS_SOURCE_UNAVAILABLE')
  }
  if (!response.ok) throw new AlertDetailsError(502, 'ALERT_DETAILS_SOURCE_ERROR')

  let body: string
  try {
    body = await response.text()
  } catch {
    throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  }
  if (body.length > MAX_RESPONSE_LENGTH) {
    throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_TOO_LARGE')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body) as unknown
  } catch {
    throw new AlertDetailsError(502, 'ALERT_DETAILS_RESPONSE_INVALID')
  }
  return parseDetails(parsed)
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)
    }
    if (!process.env.ALERTS_IN_UA_TOKEN) {
      return jsonResponse({ error: { code: 'ALERT_DETAILS_NOT_CONFIGURED' } }, 503)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      return jsonResponse(await readDetails(controller.signal), 200, true)
    } catch (error) {
      if (controller.signal.aborted) {
        return jsonResponse({ error: { code: 'ALERT_DETAILS_TIMEOUT' } }, 504)
      }
      if (error instanceof AlertDetailsError) {
        return jsonResponse({ error: { code: error.code } }, error.statusCode)
      }
      return jsonResponse({ error: { code: 'ALERT_DETAILS_SOURCE_UNAVAILABLE' } }, 502)
    } finally {
      clearTimeout(timeout)
    }
  },
}
