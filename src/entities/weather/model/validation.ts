import type { DailyForecast, WeatherCache, WeatherData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isLocalTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function isWeatherIconUrl(value: unknown): value is string | null {
  if (value === null) return true
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      url.hostname === 'cdn.weatherapi.com' &&
      url.username === '' &&
      url.password === '' &&
      url.port === ''
  } catch {
    return false
  }
}

function isDailyForecast(value: unknown): value is DailyForecast {
  if (!isRecord(value)) return false
  const date = value.date
  const parsedDate = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : null
  return (
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    parsedDate !== null &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === date &&
    (value.conditionCode === null || (typeof value.conditionCode === 'number' && Number.isInteger(value.conditionCode))) &&
    isFiniteNumberOrNull(value.temperatureMinCelsius) &&
    isFiniteNumberOrNull(value.temperatureMaxCelsius) &&
    isFiniteNumberOrNull(value.precipitationProbabilityPercent) &&
    (value.conditionText === null || typeof value.conditionText === 'string') &&
    isWeatherIconUrl(value.conditionIconUrl) &&
    (value.sunrise === null || isLocalTime(value.sunrise)) &&
    (value.sunset === null || isLocalTime(value.sunset)) &&
    isFiniteNumberOrNull(value.daylightDurationSeconds)
  )
}

export function isWeatherData(value: unknown): value is WeatherData {
  if (!isRecord(value) || !isRecord(value.current)) return false
  const current = value.current
  return (
    value.timeZone === 'Europe/Kyiv' &&
    isDateTime(value.receivedAt) &&
    isDateTime(current.time) &&
    isFiniteNumberOrNull(current.temperatureCelsius) &&
    isFiniteNumberOrNull(current.relativeHumidityPercent) &&
    isFiniteNumberOrNull(current.apparentTemperatureCelsius) &&
    (current.isDay === null || typeof current.isDay === 'boolean') &&
    (current.conditionText === null || typeof current.conditionText === 'string') &&
    isWeatherIconUrl(current.conditionIconUrl) &&
    (current.conditionCode === null || (typeof current.conditionCode === 'number' && Number.isInteger(current.conditionCode))) &&
    isFiniteNumberOrNull(current.windSpeedMetersPerSecond) &&
    isFiniteNumberOrNull(current.windDirectionDegrees) &&
    Array.isArray(value.daily) &&
    value.daily.length === 3 &&
    value.daily.every(isDailyForecast)
  )
}

export function isWeatherCache(value: unknown): value is WeatherCache {
  return (
    isRecord(value) &&
    value.version === 2 &&
    isDateTime(value.savedAt) &&
    isWeatherData(value.data)
  )
}
