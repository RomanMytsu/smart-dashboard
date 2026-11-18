import { weatherLocation } from '../config/location'
import type {
  CurrentWeather,
  DailyForecast,
  WeatherData,
  WeatherRequestDiagnostic,
} from '../model/types'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const REQUESTED_DAILY_COUNT = 3

export class WeatherRequestError extends Error {
  constructor(
    public readonly kind: 'network' | 'http' | 'invalid-data' | 'timeout',
    message: string,
  ) {
    super(message)
    this.name = 'WeatherRequestError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new WeatherRequestError('invalid-data', `Некорректное поле ${field}`)
  }
  return value
}

function readNumberOrNull(value: unknown, field: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WeatherRequestError('invalid-data', `Некорректное поле ${field}`)
  }
  return value
}

function readCodeOrNull(value: unknown, field: string): number | null {
  const code = readNumberOrNull(value, field)
  if (code !== null && !Number.isInteger(code)) {
    throw new WeatherRequestError('invalid-data', `Некорректный код в ${field}`)
  }
  return code
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WeatherRequestError('invalid-data', `Некорректное поле ${field}`)
  }
  return value
}

function readDateTime(value: unknown, field: string): string {
  const dateTime = readString(value, field)
  if (Number.isNaN(Date.parse(dateTime))) {
    throw new WeatherRequestError('invalid-data', `Некорректная дата ${field}`)
  }
  return dateTime
}

function readDate(value: unknown, field: string): string {
  const date = readString(value, field)
  const parsedDate = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new WeatherRequestError('invalid-data', `Некорректная дата ${field}`)
  }
  return date
}

function readNullableNumberArray(
  value: unknown,
  field: string,
): Array<number | null> {
  if (!Array.isArray(value) || value.length !== REQUESTED_DAILY_COUNT) {
    throw new WeatherRequestError('invalid-data', `Некорректный массив ${field}`)
  }
  return value.map((entry, index) => readNumberOrNull(entry, `${field}[${index}]`))
}

function assertUnits(root: Record<string, unknown>): void {
  const currentUnits = readRecord(root.current_units, 'current_units')
  const dailyUnits = readRecord(root.daily_units, 'daily_units')
  const expectedCurrent: Record<string, string> = {
    temperature_2m: '°C',
    relative_humidity_2m: '%',
    apparent_temperature: '°C',
    is_day: '',
    weather_code: 'wmo code',
    wind_speed_10m: 'km/h',
    wind_direction_10m: '°',
  }
  const expectedDaily: Record<string, string> = {
    weather_code: 'wmo code',
    temperature_2m_max: '°C',
    temperature_2m_min: '°C',
    precipitation_probability_max: '%',
  }

  for (const [field, unit] of Object.entries(expectedCurrent)) {
    if (currentUnits[field] !== unit) {
      throw new WeatherRequestError('invalid-data', `Неожиданная единица измерения ${field}`)
    }
  }
  for (const [field, unit] of Object.entries(expectedDaily)) {
    if (dailyUnits[field] !== unit) {
      throw new WeatherRequestError('invalid-data', `Неожиданная единица измерения ${field}`)
    }
  }
}

function parseForecastResponse(value: unknown, receivedAt: string): WeatherData {
  const root = readRecord(value, 'ответ')
  const current = readRecord(root.current, 'current')
  const daily = readRecord(root.daily, 'daily')
  assertUnits(root)

  if (root.timezone !== weatherLocation.timeZone) {
    throw new WeatherRequestError('invalid-data', 'API вернул неожиданный часовой пояс')
  }

  const currentTime = readDateTime(current.time, 'current.time')
  const rawIsDay = current.is_day
  if (rawIsDay !== null && rawIsDay !== 0 && rawIsDay !== 1) {
    throw new WeatherRequestError('invalid-data', 'Некорректное поле current.is_day')
  }

  const datesValue = daily.time
  if (!Array.isArray(datesValue) || datesValue.length !== REQUESTED_DAILY_COUNT) {
    throw new WeatherRequestError('invalid-data', 'Прогноз должен содержать три даты')
  }
  const dates = datesValue.map((date, index) => readDate(date, `daily.time[${index}]`))
  const codes = readNullableNumberArray(daily.weather_code, 'daily.weather_code').map((code, index) => {
    if (code !== null && !Number.isInteger(code)) {
      throw new WeatherRequestError('invalid-data', `Некорректный код daily.weather_code[${index}]`)
    }
    return code
  })
  const maximums = readNullableNumberArray(daily.temperature_2m_max, 'daily.temperature_2m_max')
  const minimums = readNullableNumberArray(daily.temperature_2m_min, 'daily.temperature_2m_min')
  const precipitation = readNullableNumberArray(
    daily.precipitation_probability_max,
    'daily.precipitation_probability_max',
  )

  const forecast: DailyForecast[] = dates.map((date, index) => ({
    date,
    weatherCode: codes[index],
    temperatureMinCelsius: minimums[index],
    temperatureMaxCelsius: maximums[index],
    precipitationProbabilityPercent: precipitation[index],
  }))
  const currentWeather: CurrentWeather = {
    time: currentTime,
    temperatureCelsius: readNumberOrNull(current.temperature_2m, 'current.temperature_2m'),
    relativeHumidityPercent: readNumberOrNull(current.relative_humidity_2m, 'current.relative_humidity_2m'),
    apparentTemperatureCelsius: readNumberOrNull(current.apparent_temperature, 'current.apparent_temperature'),
    isDay: rawIsDay === null ? null : rawIsDay === 1,
    weatherCode: readCodeOrNull(current.weather_code, 'current.weather_code'),
    windSpeedKmh: readNumberOrNull(current.wind_speed_10m, 'current.wind_speed_10m'),
    windDirectionDegrees: readNumberOrNull(current.wind_direction_10m, 'current.wind_direction_10m'),
  }

  return {
    timeZone: weatherLocation.timeZone,
    receivedAt,
    current: currentWeather,
    daily: forecast,
  }
}

export async function getWeather(
  signal?: AbortSignal,
  onDiagnostic?: (diagnostic: WeatherRequestDiagnostic) => void,
): Promise<WeatherData> {
  const url = new URL(FORECAST_URL)
  url.searchParams.set('latitude', String(weatherLocation.latitude))
  url.searchParams.set('longitude', String(weatherLocation.longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m',
  )
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  )
  url.searchParams.set('forecast_days', String(REQUESTED_DAILY_COUNT))
  url.searchParams.set('timezone', weatherLocation.timeZone)
  url.searchParams.set('temperature_unit', 'celsius')
  url.searchParams.set('wind_speed_unit', 'kmh')
  url.searchParams.set('precipitation_unit', 'mm')

  const startedAt = Date.now()
  const diagnostic: WeatherRequestDiagnostic = {
    url: url.toString(),
    stage: 'request-ready',
    httpStatus: null,
    durationMs: 0,
    errorType: null,
    errorMessage: null,
    jsonParsing: 'not-run',
    runtimeValidation: 'not-run',
  }
  const report = (stage: WeatherRequestDiagnostic['stage']) => {
    diagnostic.stage = stage
    diagnostic.durationMs = Date.now() - startedAt
    onDiagnostic?.({ ...diagnostic })
  }

  let response: Response
  report('fetching')
  try {
    response = await fetch(url.toString(), { signal })
  } catch (error) {
    diagnostic.errorType = error instanceof Error ? error.name : typeof error
    diagnostic.errorMessage = error instanceof Error ? error.message : String(error)
    report('failed')
    if (error instanceof Error && error.name === 'AbortError') {
      throw new WeatherRequestError('timeout', 'Время ожидания погоды истекло')
    }
    throw new WeatherRequestError(
      'network',
      'Ошибка сетевого запроса. Возможны проблемы CORS, DNS, TLS или соединения',
    )
  }

  diagnostic.httpStatus = response.status
  report('http-response')
  if (!response.ok) {
    diagnostic.errorType = 'HttpError'
    diagnostic.errorMessage = `HTTP ${response.status} ${response.statusText}`.trim()
    report('failed')
    throw new WeatherRequestError('http', `Open-Meteo ответил с кодом ${response.status}`)
  }

  let responseData: unknown
  try {
    responseData = await response.json()
  } catch {
    diagnostic.jsonParsing = 'failed'
    diagnostic.errorType = 'JsonParseError'
    diagnostic.errorMessage = 'response.json() завершился ошибкой'
    report('failed')
    throw new WeatherRequestError('invalid-data', 'Open-Meteo вернул некорректный JSON')
  }

  diagnostic.jsonParsing = 'success'
  report('json-parsed')

  try {
    const weather = parseForecastResponse(responseData, new Date().toISOString())
    diagnostic.runtimeValidation = 'success'
    report('validated')
    return weather
  } catch (error) {
    diagnostic.runtimeValidation = 'failed'
    diagnostic.errorType = error instanceof Error ? error.name : typeof error
    diagnostic.errorMessage = error instanceof Error ? error.message : String(error)
    report('failed')
    throw error
  }
}
