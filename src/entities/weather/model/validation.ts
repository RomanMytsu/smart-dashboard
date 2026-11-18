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
    (value.weatherCode === null || (typeof value.weatherCode === 'number' && Number.isInteger(value.weatherCode))) &&
    isFiniteNumberOrNull(value.temperatureMinCelsius) &&
    isFiniteNumberOrNull(value.temperatureMaxCelsius) &&
    isFiniteNumberOrNull(value.precipitationProbabilityPercent)
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
    (current.weatherCode === null || (typeof current.weatherCode === 'number' && Number.isInteger(current.weatherCode))) &&
    isFiniteNumberOrNull(current.windSpeedKmh) &&
    isFiniteNumberOrNull(current.windDirectionDegrees) &&
    Array.isArray(value.daily) &&
    value.daily.length === 3 &&
    value.daily.every(isDailyForecast)
  )
}

export function isWeatherCache(value: unknown): value is WeatherCache {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isDateTime(value.savedAt) &&
    isWeatherData(value.data)
  )
}
