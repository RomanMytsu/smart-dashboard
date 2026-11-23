import { KHARKIV_TIME_ZONE } from '@/shared/lib/timeZone'

export interface AirQualityData {
  europeanAqi: number
  pm25: number | null
  pm10: number | null
  observedAt: string
  observedAtUtcOffsetSeconds: number
  fetchedAt: string
}

export type AirQualityState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: AirQualityData; warning: string | null }
  | { status: 'stale'; data: AirQualityData; error: string | null }
  | { status: 'unavailable'; data: null; error: string }
  | { status: 'error'; data: null; error: string }

export const AIR_QUALITY_TIME_ZONE = 'Europe/Kyiv'
export const FRESH_DATA_MAX_AGE_MS = 90 * 60 * 1000
export const DISPLAYABLE_DATA_MAX_AGE_MS = 6 * 60 * 60 * 1000
export const AIR_QUALITY_REFRESH_INTERVAL_MS = 30 * 60 * 1000
export const AIR_QUALITY_CACHE_KEY = 'kharkiv-smart-dashboard:air-quality:v2'
export const AIR_QUALITY_CACHE_VERSION = 2

export interface EuropeanAqiCategory {
  label: string
  color: 'good' | 'fair' | 'moderate' | 'poor' | 'very-poor' | 'extremely-poor'
}

const AIR_QUALITY_ENDPOINT = '/api/air-quality'
const kyivDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: KHARKIV_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

interface AirQualityCache {
  version: 2
  data: AirQualityData
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function partsAsNumbers(parts: Intl.DateTimeFormatPart[]): Record<string, number> {
  const values: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = Number(part.value)
  }
  return values
}

/** Interprets Open-Meteo's offset-free current.time in the response's Kyiv timezone. */
export function getObservedAtTimestamp(value: string, utcOffsetSeconds?: number): number | null {
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? timestamp : null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText ?? '0')
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const targetDate = new Date(targetAsUtc)
  if (
    targetDate.getUTCFullYear() !== year || targetDate.getUTCMonth() + 1 !== month ||
    targetDate.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59
  ) return null

  if (utcOffsetSeconds !== undefined) {
    if (!Number.isInteger(utcOffsetSeconds) || Math.abs(utcOffsetSeconds) > 14 * 60 * 60) return null
    const timestamp = targetAsUtc - utcOffsetSeconds * 1000
    const verified = partsAsNumbers(kyivDateTimeFormatter.formatToParts(new Date(timestamp)))
    return verified.year === year && verified.month === month && verified.day === day &&
      verified.hour === hour && verified.minute === minute && verified.second === second
      ? timestamp
      : null
  }

  let timestamp = targetAsUtc
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = partsAsNumbers(kyivDateTimeFormatter.formatToParts(new Date(timestamp)))
    const representedAsUtc = Date.UTC(
      zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second,
    )
    const adjustment = targetAsUtc - representedAsUtc
    timestamp += adjustment
    if (adjustment === 0) break
  }

  const verified = partsAsNumbers(kyivDateTimeFormatter.formatToParts(new Date(timestamp)))
  return verified.year === year && verified.month === month && verified.day === day &&
    verified.hour === hour && verified.minute === minute && verified.second === second
    ? timestamp
    : null
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function getEuropeanAqiCategory(aqi: number): EuropeanAqiCategory | null {
  if (!Number.isFinite(aqi) || aqi < 0) return null
  if (aqi <= 20) return { label: 'Хорошее', color: 'good' }
  if (aqi <= 40) return { label: 'Приемлемое', color: 'fair' }
  if (aqi <= 60) return { label: 'Умеренное', color: 'moderate' }
  if (aqi <= 80) return { label: 'Плохое', color: 'poor' }
  if (aqi <= 100) return { label: 'Очень плохое', color: 'very-poor' }
  return { label: 'Крайне плохое', color: 'extremely-poor' }
}

function isAirQualityData(value: unknown, now: number): value is AirQualityData {
  if (!isRecord(value)) return false
  if (!isNonNegativeFiniteNumber(value.europeanAqi)) return false
  if (!(value.pm25 === null || isNonNegativeFiniteNumber(value.pm25))) return false
  if (!(value.pm10 === null || isNonNegativeFiniteNumber(value.pm10))) return false
  if (typeof value.observedAt !== 'string' || !Number.isInteger(value.observedAtUtcOffsetSeconds)) return false
  if (Math.abs(value.observedAtUtcOffsetSeconds as number) > 14 * 60 * 60) return false
  if (getObservedAtTimestamp(value.observedAt, value.observedAtUtcOffsetSeconds as number) === null) return false
  if (typeof value.fetchedAt !== 'string' || !Number.isFinite(Date.parse(value.fetchedAt))) return false

  const observedAt = getObservedAtTimestamp(value.observedAt, value.observedAtUtcOffsetSeconds as number)
  const fetchedAt = Date.parse(value.fetchedAt)
  if (observedAt === null || fetchedAt > now || now - fetchedAt > DISPLAYABLE_DATA_MAX_AGE_MS) return false
  const age = now - observedAt
  return age >= 0 && age <= DISPLAYABLE_DATA_MAX_AGE_MS
}

export function getAirQualityAge(data: AirQualityData, now: number): number | null {
  const observedAt = getObservedAtTimestamp(data.observedAt, data.observedAtUtcOffsetSeconds)
  if (observedAt === null) return null
  const age = now - observedAt
  return age >= 0 ? age : null
}

export function stateForAirQualityData(
  data: AirQualityData,
  now: number,
  error: string | null = null,
): AirQualityState {
  const age = getAirQualityAge(data, now)
  if (age === null || age > DISPLAYABLE_DATA_MAX_AGE_MS) {
    const unavailableMessage = 'Нет актуальных данных о качестве воздуха'
    return { status: 'unavailable', data: null, error: error ? `${unavailableMessage}. ${error}` : unavailableMessage }
  }
  if (age < FRESH_DATA_MAX_AGE_MS) return { status: 'success', data, warning: error }
  return { status: 'stale', data, error }
}

function readCache(value: unknown, now: number): AirQualityData | null {
  if (!isRecord(value) || value.version !== AIR_QUALITY_CACHE_VERSION) return null
  return isAirQualityData(value.data, now) ? value.data : null
}

export function readCachedAirQuality(now = Date.now()): AirQualityData | null {
  try {
    const serialized = window.localStorage.getItem(AIR_QUALITY_CACHE_KEY)
    if (!serialized) return null
    const parsed: unknown = JSON.parse(serialized)
    return readCache(parsed, now)
  } catch {
    return null
  }
}

export function serializeAirQualityCache(data: AirQualityData): string {
  const cache: AirQualityCache = { version: AIR_QUALITY_CACHE_VERSION, data }
  return JSON.stringify(cache)
}

export async function fetchAirQuality(signal: AbortSignal): Promise<AirQualityData> {
  const response = await fetch(AIR_QUALITY_ENDPOINT, { signal })
  if (!response.ok) throw new Error(`Сервис качества воздуха ответил с кодом ${response.status}`)

  const value: unknown = await response.json()
  if (!isRecord(value) || !isRecord(value.current)) throw new Error('Нет данных о качестве воздуха')
  if (value.timezone !== AIR_QUALITY_TIME_ZONE) throw new Error('Неожиданный часовой пояс ответа качества воздуха')

  const current = value.current
  const aqi = current.european_aqi
  const pm25 = current.pm2_5
  const pm10 = current.pm10
  const observedAt = current.time
  const utcOffsetSeconds = value.utc_offset_seconds
  if (!isNonNegativeFiniteNumber(aqi)) throw new Error('Некорректное значение European AQI')
  if (!(pm25 === null || isNonNegativeFiniteNumber(pm25))) throw new Error('Некорректное значение PM2.5')
  if (!(pm10 === null || isNonNegativeFiniteNumber(pm10))) throw new Error('Некорректное значение PM10')
  if (typeof observedAt !== 'string' || getObservedAtTimestamp(observedAt) === null) {
    throw new Error('Некорректное время данных качества воздуха')
  }
  if (!Number.isInteger(utcOffsetSeconds) || Math.abs(utcOffsetSeconds as number) > 14 * 60 * 60) {
    throw new Error('Некорректное смещение часового пояса качества воздуха')
  }
  if (getObservedAtTimestamp(observedAt, utcOffsetSeconds as number) === null) {
    throw new Error('Время качества воздуха не соответствует часовому поясу ответа')
  }

  return {
    europeanAqi: aqi,
    pm25,
    pm10,
    observedAt,
    observedAtUtcOffsetSeconds: utcOffsetSeconds as number,
    fetchedAt: new Date().toISOString(),
  }
}
