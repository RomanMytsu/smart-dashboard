import type {
  CurrentWeather,
  DailyForecast,
  WeatherData,
  WeatherRequestDiagnostic,
} from '../model/types'
import { isWeatherData } from '../model/validation'

const WEATHER_ENDPOINT = '/api/weather'

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

export async function getWeather(
  signal?: AbortSignal,
  onDiagnostic?: (diagnostic: WeatherRequestDiagnostic) => void,
): Promise<WeatherData> {
  const startedAt = Date.now()
  const diagnostic: WeatherRequestDiagnostic = {
    url: WEATHER_ENDPOINT,
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

  report('fetching')
  let response: Response
  try {
    response = await fetch(WEATHER_ENDPOINT, { signal })
  } catch (error) {
    diagnostic.errorType = error instanceof Error ? error.name : typeof error
    diagnostic.errorMessage = 'Сетевой запрос погоды завершился ошибкой'
    report('failed')
    if (error instanceof Error && error.name === 'AbortError') {
      throw new WeatherRequestError('timeout', 'Время ожидания погоды истекло')
    }
    throw new WeatherRequestError('network', 'Не удалось получить погоду')
  }

  diagnostic.httpStatus = response.status
  report('http-response')
  let responseData: unknown
  try {
    responseData = await response.json()
  } catch {
    diagnostic.jsonParsing = 'failed'
    diagnostic.errorType = 'JsonParseError'
    diagnostic.errorMessage = 'Ответ сервера не является корректным JSON'
    report('failed')
    throw new WeatherRequestError('invalid-data', 'Сервер вернул некорректные данные о погоде')
  }

  diagnostic.jsonParsing = 'success'
  report('json-parsed')

  if (!response.ok) {
    const errorKind = isRecord(responseData) && isRecord(responseData.error)
      ? responseData.error.kind
      : null
    const kind = errorKind === 'timeout' ? 'timeout' : 'http'
    diagnostic.errorType = 'HttpError'
    diagnostic.errorMessage = `Сервер погоды ответил с кодом ${response.status}`
    report('failed')
    throw new WeatherRequestError(
      kind,
      kind === 'timeout' ? 'WeatherAPI не ответил за 12 секунд' : 'Сервис погоды временно недоступен',
    )
  }

  if (!isWeatherData(responseData)) {
    diagnostic.runtimeValidation = 'failed'
    diagnostic.errorType = 'ValidationError'
    diagnostic.errorMessage = 'Ответ не соответствует модели погоды'
    report('failed')
    throw new WeatherRequestError('invalid-data', 'Сервер вернул некорректные данные о погоде')
  }

  diagnostic.runtimeValidation = 'success'
  report('validated')
  return responseData
}

export type { CurrentWeather, DailyForecast, WeatherData }
