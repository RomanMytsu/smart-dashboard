const ALERTS_URL =
  'https://api.alerts.in.ua/v2/iot/active_air_raid_alerts/1293.json'
const UPSTREAM_TIMEOUT_MS = 10_000
const MAX_RESPONSE_LENGTH = 32

type NormalizedAlertStatus = {
  status: 'active' | 'partial' | 'inactive'
  level: 'red' | 'yellow' | null
}

class AlertsApiError extends Error {
  public readonly statusCode: number
  public readonly code: string

  public constructor(statusCode: number, code: string) {
    super(code)
    this.statusCode = statusCode
    this.code = code
  }
}

function jsonResponse(
  payload: unknown,
  statusCode = 200,
  cacheSuccess = false,
): Response {
  const headers: Record<string, string> = {
    'Cache-Control': cacheSuccess
      ? 'public, max-age=0, must-revalidate'
      : 'private, no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }

  if (cacheSuccess) {
    headers['Vercel-CDN-Cache-Control'] =
      'public, s-maxage=60, stale-while-revalidate=30'
  }

  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers,
  })
}

function normalizeAlertStatus(value: unknown): NormalizedAlertStatus {
  if (value === 'R') return { status: 'active', level: 'red' }
  if (value === 'Y') return { status: 'active', level: 'yellow' }
  if (value === 'P') return { status: 'partial', level: null }
  if (value === 'N') return { status: 'inactive', level: null }

  throw new AlertsApiError(502, 'ALERTS_RESPONSE_INVALID')
}

async function readUpstreamStatus(signal: AbortSignal): Promise<NormalizedAlertStatus> {
  const token = process.env.ALERTS_IN_UA_TOKEN
  if (!token) throw new AlertsApiError(503, 'ALERTS_NOT_CONFIGURED')

  let response: Response
  try {
    response = await fetch(ALERTS_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal,
      cache: 'no-store',
    })
  } catch {
    if (signal.aborted) throw new AlertsApiError(504, 'ALERTS_TIMEOUT')
    throw new AlertsApiError(502, 'ALERTS_SOURCE_UNAVAILABLE')
  }

  if (!response.ok) throw new AlertsApiError(502, 'ALERTS_SOURCE_ERROR')

  let responseText: string
  try {
    responseText = await response.text()
  } catch {
    throw new AlertsApiError(502, 'ALERTS_RESPONSE_INVALID')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    throw new AlertsApiError(502, 'ALERTS_RESPONSE_INVALID')
  }

  if (responseText.length > MAX_RESPONSE_LENGTH) {
    throw new AlertsApiError(502, 'ALERTS_RESPONSE_INVALID')
  }

  return normalizeAlertStatus(parsed)
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
      return jsonResponse(await readUpstreamStatus(controller.signal), 200, true)
    } catch (error) {
      if (controller.signal.aborted) {
        return jsonResponse({ error: { code: 'ALERTS_TIMEOUT' } }, 504)
      }
      if (error instanceof AlertsApiError) {
        return jsonResponse({ error: { code: error.code } }, error.statusCode)
      }
      return jsonResponse({ error: { code: 'ALERTS_SOURCE_UNAVAILABLE' } }, 502)
    } finally {
      clearTimeout(timeout)
    }
  },
}
