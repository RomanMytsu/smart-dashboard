export interface WeatherUnits {
  temperature: '°C'
  humidity: '%'
  windSpeed: 'km/h'
  windDirection: '°'
  precipitationProbability: '%'
}

export const weatherUnits: WeatherUnits = {
  temperature: '°C',
  humidity: '%',
  windSpeed: 'km/h',
  windDirection: '°',
  precipitationProbability: '%',
}

export interface CurrentWeather {
  time: string
  temperatureCelsius: number | null
  relativeHumidityPercent: number | null
  apparentTemperatureCelsius: number | null
  isDay: boolean | null
  weatherCode: number | null
  windSpeedKmh: number | null
  windDirectionDegrees: number | null
}

export interface DailyForecast {
  date: string
  weatherCode: number | null
  temperatureMinCelsius: number | null
  temperatureMaxCelsius: number | null
  precipitationProbabilityPercent: number | null
}

export interface WeatherData {
  timeZone: string
  receivedAt: string
  current: CurrentWeather
  daily: DailyForecast[]
}

export type WeatherErrorKind =
  | 'network'
  | 'http'
  | 'invalid-data'
  | 'timeout'
  | 'storage'

export interface WeatherError {
  kind: WeatherErrorKind
  message: string
}

export interface WeatherCache {
  version: 1
  savedAt: string
  data: WeatherData
}

export type WeatherState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: WeatherData; error: null; warning?: WeatherError }
  | { status: 'refreshing'; data: WeatherData; error: null }
  | { status: 'stale'; data: WeatherData; error: WeatherError }
  | { status: 'error'; data: null; error: WeatherError }

export type WeatherIconKind =
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown'

export interface WeatherPresentation {
  description: string
  icon: WeatherIconKind
}

export type WeatherDiagnosticStage =
  | 'request-ready'
  | 'fetching'
  | 'http-response'
  | 'json-parsed'
  | 'validated'
  | 'failed'

export type WeatherDiagnosticResult = 'not-run' | 'success' | 'failed'

export interface WeatherRequestDiagnostic {
  url: string
  stage: WeatherDiagnosticStage
  httpStatus: number | null
  durationMs: number | null
  errorType: string | null
  errorMessage: string | null
  jsonParsing: WeatherDiagnosticResult
  runtimeValidation: WeatherDiagnosticResult
}
