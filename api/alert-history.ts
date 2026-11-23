const ALERT_HISTORY_URL = 'https://api.alerts.in.ua/v1/regions/1293/alerts/month_ago.json'
const ALERT_LOCATION_UID = '1293'
const UPSTREAM_TIMEOUT_MS = 10_000
const MAX_RESPONSE_LENGTH = 2_000_000
const CACHE_SECONDS = 30 * 60

interface AlertHistoryEvent {
  alertType: 'air_raid' | 'artillery_shelling'
  startedAt: string
  finishedAt: string | null
}

class AlertHistoryError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(code)
    this.name = 'AlertHistoryError'
  }
}

function jsonResponse(payload: unknown, statusCode = 200, cacheSuccess = false): Response {
  const headers: Record<string, string> = {
    'Cache-Control': cacheSuccess
      ? 'public, max-age=0, must-revalidate'
      : 'private, no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }
  if (cacheSuccess) {
    headers['Vercel-CDN-Cache-Control'] =
      `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`
  }
  return new Response(JSON.stringify(payload), { status: statusCode, headers })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

function parseHistory(value: unknown): AlertHistoryEvent[] {
  if (!isRecord(value) || !Array.isArray(value.alerts)) {
    throw new AlertHistoryError(502, 'ALERT_HISTORY_RESPONSE_INVALID')
  }

  const events: AlertHistoryEvent[] = []
  for (const item of value.alerts) {
    if (!isRecord(item) || typeof item.alert_type !== 'string') {
      throw new AlertHistoryError(502, 'ALERT_HISTORY_RESPONSE_INVALID')
    }
    const rawUid = item.location_uid
    if ((typeof rawUid !== 'string' && typeof rawUid !== 'number') || typeof item.location_type !== 'string') {
      throw new AlertHistoryError(502, 'ALERT_HISTORY_RESPONSE_INVALID')
    }
    const locationUid = String(rawUid)
    const alertType = item.alert_type
    if (
      locationUid !== ALERT_LOCATION_UID ||
      item.location_type !== 'hromada' ||
      (alertType !== 'air_raid' && alertType !== 'artillery_shelling')
    ) continue

    if (!isIsoTimestamp(item.started_at)) {
      throw new AlertHistoryError(502, 'ALERT_HISTORY_RESPONSE_INVALID')
    }
    const finishedAt = item.finished_at
    if (finishedAt !== null && !isIsoTimestamp(finishedAt)) {
      throw new AlertHistoryError(502, 'ALERT_HISTORY_RESPONSE_INVALID')
    }
    if (finishedAt !== null && Date.parse(finishedAt) < Date.parse(item.started_at)) {
      throw new AlertHistoryError(502, 'ALERT_HISTORY_RESPONSE_INVALID')
    }
    events.push({ alertType, startedAt: item.started_at, finishedAt })
  }
  return events
}

async function readHistory(signal: AbortSignal): Promise<AlertHistoryEvent[]> {
  const token = process.env.ALERTS_IN_UA_TOKEN
  if (!token) throw new AlertHistoryError(503, 'ALERTS_NOT_CONFIGURED')

  let response: Response
  try {
    response = await fetch(ALERT_HISTORY_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal,
      cache: 'no-store',
    })
  } catch {
    if (signal.aborted) throw new AlertHistoryError(504, 'ALERT_HISTORY_TIMEOUT')
    throw new AlertHistoryError(502, 'ALERT_HISTORY_SOURCE_UNAVAILABLE')
  }
  if (!response.ok) throw new AlertHistoryError(502, 'ALERT_HISTORY_SOURCE_ERROR')

  let body: string
  try {
    body = await response.text()
  } catch {
    throw new AlertHistoryError(502, 'ALERT_HISTORY_RESPONSE_INVALID')
  }
  if (body.length > MAX_RESPONSE_LENGTH) {
    throw new AlertHistoryError(502, 'ALERT_HISTORY_RESPONSE_TOO_LARGE')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new AlertHistoryError(502, 'ALERT_HISTORY_RESPONSE_INVALID')
  }
  return parseHistory(parsed)
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)
    }
    if (!process.env.ALERTS_IN_UA_TOKEN) {
      return jsonResponse({ error: { code: 'ALERTS_NOT_CONFIGURED' } }, 503)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      return jsonResponse({ events: await readHistory(controller.signal) }, 200, true)
    } catch (error) {
      if (controller.signal.aborted) {
        return jsonResponse({ error: { code: 'ALERT_HISTORY_TIMEOUT' } }, 504)
      }
      if (error instanceof AlertHistoryError) {
        return jsonResponse({ error: { code: error.code } }, error.statusCode)
      }
      return jsonResponse({ error: { code: 'ALERT_HISTORY_SOURCE_UNAVAILABLE' } }, 502)
    } finally {
      clearTimeout(timeout)
    }
  },
}
