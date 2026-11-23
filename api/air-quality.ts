const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const AIR_QUALITY_TIME_ZONE = 'Europe/Kyiv'
const UPSTREAM_TIMEOUT_MS = 12_000
const MAX_RESPONSE_LENGTH = 128_000

interface AirQualityResponse {
  timezone: string
  utc_offset_seconds: number
  current: {
    european_aqi: number
    pm2_5: number | null
    pm10: number | null
    time: string
  }
}

class AirQualityApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly kind: 'timeout' | 'upstream' | 'invalid-data',
  ) {
    super(kind)
    this.name = 'AirQualityApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isValidLocalDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText ?? '0')
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
}

function parseAirQualityResponse(value: unknown): AirQualityResponse {
  if (
    !isRecord(value) ||
    value.timezone !== AIR_QUALITY_TIME_ZONE ||
    !Number.isInteger(value.utc_offset_seconds) ||
    Math.abs(value.utc_offset_seconds as number) > 14 * 60 * 60 ||
    !isRecord(value.current)
  ) throw new AirQualityApiError(502, 'invalid-data')

  const current = value.current
  if (
    !isNonNegativeFiniteNumber(current.european_aqi) ||
    !(current.pm2_5 === null || isNonNegativeFiniteNumber(current.pm2_5)) ||
    !(current.pm10 === null || isNonNegativeFiniteNumber(current.pm10)) ||
    !isValidLocalDateTime(current.time)
  ) throw new AirQualityApiError(502, 'invalid-data')

  return {
    timezone: AIR_QUALITY_TIME_ZONE,
    utc_offset_seconds: value.utc_offset_seconds as number,
    current: {
      european_aqi: current.european_aqi,
      pm2_5: current.pm2_5,
      pm10: current.pm10,
      time: current.time,
    },
  }
}

function jsonResponse(
  payload: unknown,
  statusCode: number,
  cacheSuccess = false,
): Response {
  const headers: Record<string, string> = {
    'Cache-Control': cacheSuccess ? 'public, max-age=0, must-revalidate' : 'private, no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }
  if (cacheSuccess) {
    headers['Vercel-CDN-Cache-Control'] = 'public, s-maxage=1800, stale-while-revalidate=300'
  }
  return new Response(JSON.stringify(payload), { status: statusCode, headers })
}

async function fetchAirQuality(signal: AbortSignal): Promise<AirQualityResponse> {
  const url = new URL(AIR_QUALITY_URL)
  url.searchParams.set('latitude', '49.98177')
  url.searchParams.set('longitude', '36.25475')
  url.searchParams.set('current', 'european_aqi,pm2_5,pm10')
  url.searchParams.set('timezone', AIR_QUALITY_TIME_ZONE)
  url.searchParams.set('domains', 'cams_europe')

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
      cache: 'no-store',
    })
  } catch {
    if (signal.aborted) throw new AirQualityApiError(504, 'timeout')
    throw new AirQualityApiError(502, 'upstream')
  }
  if (!response.ok) throw new AirQualityApiError(502, 'upstream')

  const contentLength = response.headers.get('content-length')
  if (contentLength !== null && Number(contentLength) > MAX_RESPONSE_LENGTH) {
    throw new AirQualityApiError(502, 'invalid-data')
  }

  let body: string
  try {
    body = await response.text()
  } catch {
    throw new AirQualityApiError(502, 'invalid-data')
  }
  if (body.length > MAX_RESPONSE_LENGTH) throw new AirQualityApiError(502, 'invalid-data')

  let parsed: unknown
  try {
    parsed = JSON.parse(body) as unknown
  } catch {
    throw new AirQualityApiError(502, 'invalid-data')
  }
  return parseAirQualityResponse(parsed)
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return jsonResponse({ error: { kind: 'http' } }, 405)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      return jsonResponse(await fetchAirQuality(controller.signal), 200, true)
    } catch (error) {
      if (error instanceof AirQualityApiError) {
        return jsonResponse({ error: { kind: error.kind } }, error.statusCode)
      }
      return jsonResponse({ error: { kind: 'upstream' } }, 502)
    } finally {
      clearTimeout(timeout)
    }
  },
}
