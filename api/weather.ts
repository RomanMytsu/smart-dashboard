import type { CurrentWeather, DailyForecast, WeatherData } from '../src/entities/weather/model/types.js'

const WEATHER_API_URL = 'https://api.weatherapi.com/v1/forecast.json'
const LOCATION_TIME_ZONE = 'Europe/Kyiv'
const REQUESTED_DAYS = 3
const UPSTREAM_TIMEOUT_MS = 12_000
const MAX_RESPONSE_LENGTH = 1_000_000

interface WeatherApiCondition {
  text?: unknown
  icon?: unknown
  code?: unknown
}

interface WeatherApiResponse {
  location?: { tz_id?: unknown }
  current?: {
    temp_c?: unknown
    feelslike_c?: unknown
    humidity?: unknown
    wind_kph?: unknown
    is_day?: unknown
    condition?: unknown
  }
  forecast?: { forecastday?: unknown }
}

class WeatherApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly kind: 'configuration' | 'timeout' | 'upstream' | 'invalid-data',
  ) {
    super(kind)
    this.name = 'WeatherApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  return value
}

function readOptionalInteger(value: unknown): number | null {
  const number = readOptionalNumber(value)
  if (number !== null && !Number.isInteger(number)) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  return number
}

function readOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new WeatherApiError(502, 'invalid-data')
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function readDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  return value
}

function readCondition(value: unknown): WeatherApiCondition {
  if (!isRecord(value)) throw new WeatherApiError(502, 'invalid-data')
  return value
}

function normalizeIconUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const candidate = value.startsWith('//') ? `https:${value}` : value
  try {
    const url = new URL(candidate)
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'cdn.weatherapi.com' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port !== ''
    ) return null
    return url.toString()
  } catch {
    return null
  }
}

function readConditionFields(value: unknown): Pick<CurrentWeather, 'conditionText' | 'conditionIconUrl' | 'conditionCode'> {
  if (value === null || value === undefined) {
    return { conditionText: null, conditionIconUrl: null, conditionCode: null }
  }
  const condition = readCondition(value)
  return {
    conditionText: readOptionalString(condition.text),
    conditionIconUrl: normalizeIconUrl(condition.icon),
    conditionCode: readOptionalInteger(condition.code),
  }
}

function parseLocalTime(value: unknown): { time: string | null; minutes: number | null } {
  if (value === undefined || value === null) return { time: null, minutes: null }
  if (typeof value !== 'string') throw new WeatherApiError(502, 'invalid-data')
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim())
  if (!match) throw new WeatherApiError(502, 'invalid-data')
  const hour = Number(match[1])
  const minute = Number(match[2])
  const meridiem = match[3].toUpperCase()
  if (hour < 1 || hour > 12 || minute > 59) throw new WeatherApiError(502, 'invalid-data')
  const hour24 = (hour % 12) + (meridiem === 'PM' ? 12 : 0)
  return {
    time: `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    minutes: hour24 * 60 + minute,
  }
}

function parseForecastDay(value: unknown): DailyForecast {
  if (!isRecord(value) || !isRecord(value.day)) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  const astro = value.astro === null || value.astro === undefined
    ? {}
    : isRecord(value.astro) ? value.astro : null
  if (astro === null) throw new WeatherApiError(502, 'invalid-data')
  const condition = readConditionFields(value.day.condition)
  const sunrise = parseLocalTime(astro.sunrise)
  const sunset = parseLocalTime(astro.sunset)
  const daylightMinutes = sunrise.minutes !== null && sunset.minutes !== null && sunset.minutes >= sunrise.minutes
    ? sunset.minutes - sunrise.minutes
    : null
  const maximum = readOptionalNumber(value.day.maxtemp_c)
  const minimum = readOptionalNumber(value.day.mintemp_c)
  const rainChance = readOptionalNumber(value.day.daily_chance_of_rain)
  if (rainChance !== null && (rainChance < 0 || rainChance > 100)) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  return {
    date: readDate(value.date),
    ...condition,
    temperatureMinCelsius: minimum,
    temperatureMaxCelsius: maximum,
    precipitationProbabilityPercent: rainChance,
    sunrise: sunrise.time,
    sunset: sunset.time,
    daylightDurationSeconds: daylightMinutes === null ? null : daylightMinutes * 60,
  }
}

function parseWeatherResponse(value: unknown): WeatherData {
  const root = value as WeatherApiResponse
  if (!isRecord(root) || !isRecord(root.location) || !isRecord(root.current) || !isRecord(root.forecast)) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  if (root.location.tz_id !== LOCATION_TIME_ZONE) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  if (!isRecord(root.forecast)) throw new WeatherApiError(502, 'invalid-data')
  const forecastDays = root.forecast.forecastday
  if (!Array.isArray(forecastDays) || forecastDays.length !== REQUESTED_DAYS) {
    throw new WeatherApiError(502, 'invalid-data')
  }

  const current = root.current
  const isDayValue = current.is_day
  if (isDayValue !== undefined && isDayValue !== null && isDayValue !== 0 && isDayValue !== 1) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  const humidity = readOptionalNumber(current.humidity)
  if (humidity !== null && (humidity < 0 || humidity > 100)) {
    throw new WeatherApiError(502, 'invalid-data')
  }
  const windKph = readOptionalNumber(current.wind_kph)
  if (windKph !== null && windKph < 0) throw new WeatherApiError(502, 'invalid-data')

  const receivedAt = new Date().toISOString()
  const currentWeather: CurrentWeather = {
    time: receivedAt,
    temperatureCelsius: readOptionalNumber(current.temp_c),
    relativeHumidityPercent: humidity,
    apparentTemperatureCelsius: readOptionalNumber(current.feelslike_c),
    isDay: isDayValue === null || isDayValue === undefined ? null : isDayValue === 1,
    ...readConditionFields(current.condition),
    windSpeedMetersPerSecond: windKph === null ? null : windKph / 3.6,
    windDirectionDegrees: null,
  }

  return {
    timeZone: LOCATION_TIME_ZONE,
    receivedAt,
    current: currentWeather,
    daily: forecastDays.map(parseForecastDay),
  }
}

function jsonResponse(payload: unknown, statusCode: number, cacheSuccess = false): Response {
  const headers: Record<string, string> = {
    'Cache-Control': cacheSuccess ? 'public, max-age=0, must-revalidate' : 'private, no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }
  if (cacheSuccess) {
    headers['Vercel-CDN-Cache-Control'] = 'public, s-maxage=600, stale-while-revalidate=300'
  }
  return new Response(JSON.stringify(payload), { status: statusCode, headers })
}

async function fetchWeather(signal: AbortSignal): Promise<WeatherData> {
  const key = process.env.WEATHER_API_KEY
  if (!key) throw new WeatherApiError(503, 'configuration')

  const url = new URL(WEATHER_API_URL)
  url.searchParams.set('key', key)
  url.searchParams.set('q', '49.98177,36.25475')
  url.searchParams.set('days', String(REQUESTED_DAYS))
  url.searchParams.set('aqi', 'no')
  url.searchParams.set('alerts', 'no')
  url.searchParams.set('lang', 'ru')

  let response: Response
  try {
    response = await fetch(url.toString(), { method: 'GET', signal, cache: 'no-store' })
  } catch {
    if (signal.aborted) throw new WeatherApiError(504, 'timeout')
    throw new WeatherApiError(502, 'upstream')
  }
  if (!response.ok) throw new WeatherApiError(502, 'upstream')

  let body: string
  try {
    body = await response.text()
  } catch {
    throw new WeatherApiError(502, 'invalid-data')
  }
  if (body.length > MAX_RESPONSE_LENGTH) throw new WeatherApiError(502, 'invalid-data')

  let parsed: unknown
  try {
    parsed = JSON.parse(body) as unknown
  } catch {
    throw new WeatherApiError(502, 'invalid-data')
  }
  return parseWeatherResponse(parsed)
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return jsonResponse({ error: { kind: 'http' } }, 405)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      return jsonResponse(await fetchWeather(controller.signal), 200, true)
    } catch (error) {
      if (error instanceof WeatherApiError) {
        return jsonResponse({ error: { kind: error.kind } }, error.statusCode)
      }
      return jsonResponse({ error: { kind: 'upstream' } }, 502)
    } finally {
      clearTimeout(timeout)
    }
  },
}
