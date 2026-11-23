export interface WeatherUnits {
  temperature: '°C'
  humidity: '%'
  windSpeed: 'm/s'
  windDirection: '°'
  precipitationProbability: '%'
}

export const weatherUnits: WeatherUnits = {
  temperature: '°C',
  humidity: '%',
  windSpeed: 'm/s',
  windDirection: '°',
  precipitationProbability: '%',
}

export interface CurrentWeather {
  time: string
  temperatureCelsius: number | null
  relativeHumidityPercent: number | null
  apparentTemperatureCelsius: number | null
  isDay: boolean | null
  conditionText: string | null
  conditionIconUrl: string | null
  conditionCode: number | null
  windSpeedMetersPerSecond: number | null
  windDirectionDegrees: number | null
}

export interface DailyForecast {
  date: string
  conditionText: string | null
  conditionIconUrl: string | null
  conditionCode: number | null
  temperatureMinCelsius: number | null
  temperatureMaxCelsius: number | null
  precipitationProbabilityPercent: number | null
  sunrise: string | null
  sunset: string | null
  daylightDurationSeconds: number | null
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
  version: 2
  savedAt: string
  data: WeatherData
}

export type WeatherState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: WeatherData; error: null; warning?: WeatherError }
  | { status: 'refreshing'; data: WeatherData; error: null }
  | { status: 'stale'; data: WeatherData; error: WeatherError }
  | { status: 'error'; data: null; error: WeatherError }

export type WeatherIconKind = 'cloud'

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
