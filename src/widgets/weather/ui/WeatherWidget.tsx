import { getWeatherPresentation, weatherUnits } from '@/entities/weather'
import type {
  WeatherIconKind,
  WeatherRequestDiagnostic,
  WeatherState,
} from '@/entities/weather'
import { Panel } from '@/shared/ui/panel'
import { useWeather } from '../model/useWeather'
import styles from './WeatherWidget.module.scss'

const KYIV_TIME_ZONE = 'Europe/Kyiv'

function createDateFormatter(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      ...options,
      timeZone: KYIV_TIME_ZONE,
    })
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return new Intl.DateTimeFormat('ru-RU', {
      ...options,
      timeZone: 'Europe/Kiev',
    })
  }
}

const clockFormatter = createDateFormatter({ hour: '2-digit', minute: '2-digit', hour12: false })
const forecastDateFormatter = createDateFormatter({ weekday: 'short' })
const fullForecastDateFormatter = createDateFormatter({ day: 'numeric', month: 'short' })

function formatTemperature(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}${weatherUnits.temperature}`
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}${weatherUnits.precipitationProbability}`
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : clockFormatter.format(date)
}

function getDayLabel(dateValue: string, index: number): string {
  if (index === 0) return 'Сегодня'
  if (index === 1) return 'Завтра'
  const date = new Date(`${dateValue}T12:00:00Z`)
  return `${forecastDateFormatter.format(date)}, ${fullForecastDateFormatter.format(date)}`
}

function getStatusLabel(state: WeatherState): string {
  switch (state.status) {
    case 'loading':
      return 'Загружаем погоду…'
    case 'success':
      return state.warning ? 'Загружено без кэша' : `Обновлено в ${formatTime(state.data.receivedAt)}`
    case 'refreshing':
      return `Обновление · данные от ${formatTime(state.data.receivedAt)}`
    case 'stale':
      return `Сохранённые данные от ${formatTime(state.data.receivedAt)}`
    case 'error':
      return 'Нет данных'
  }
}

function getDiagnosticResultLabel(result: WeatherRequestDiagnostic['jsonParsing']): string {
  switch (result) {
    case 'not-run':
      return 'не выполнено'
    case 'success':
      return 'успешно'
    case 'failed':
      return 'ошибка'
  }
}

function getDiagnosticStageLabel(stage: WeatherRequestDiagnostic['stage']): string {
  switch (stage) {
    case 'request-ready':
      return 'URL построен'
    case 'fetching':
      return 'выполняется fetch'
    case 'http-response':
      return 'получен HTTP-ответ'
    case 'json-parsed':
      return 'JSON разобран'
    case 'validated':
      return 'валидация пройдена'
    case 'failed':
      return 'ошибка'
  }
}

function WeatherAttribution() {
  return (
    <div className={styles['weather-widget__attribution']}>
      <a href="https://open-meteo.com/" rel="noreferrer" target="_blank">
        Погода: Open-Meteo
      </a>
      <a href="https://www.geonames.org/" rel="noreferrer" target="_blank">
        Город: GeoNames
      </a>
    </div>
  )
}

function WeatherIcon({ kind, className }: { kind: WeatherIconKind; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 48 48"
    >
      {kind === 'sun' && (
        <>
          <circle cx="24" cy="24" r="8" />
          <path d="M24 4v6m0 28v6M4 24h6m28 0h6M9.9 9.9l4.2 4.2m19.8 19.8 4.2 4.2m0-28.2-4.2 4.2M14.1 33.9l-4.2 4.2" />
        </>
      )}
      {kind === 'moon' && <path d="M34 31A16 16 0 0 1 17 8a16 16 0 1 0 17 23Z" />}
      {kind === 'cloud' && <path d="M12 34h23a8 8 0 0 0 0-16h-1a12 12 0 0 0-23 4 6 6 0 0 0 1 12Z" />}
      {kind === 'fog' && (
        <>
          <path d="M12 25h23a7 7 0 0 0 0-14h-1a11 11 0 0 0-21 4" />
          <path d="M8 32h30M12 39h24" />
        </>
      )}
      {kind === 'drizzle' && (
        <>
          <path d="M12 27h23a7 7 0 0 0 0-14h-1a11 11 0 0 0-21 4" />
          <path d="m17 33-2 4m11-4-2 4m11-4-2 4" />
        </>
      )}
      {kind === 'rain' && (
        <>
          <path d="M12 26h23a7 7 0 0 0 0-14h-1a11 11 0 0 0-21 4" />
          <path d="m17 32-3 7m13-7-3 7m13-7-3 7" />
        </>
      )}
      {kind === 'snow' && (
        <>
          <path d="M12 24h23a7 7 0 0 0 0-14h-1a11 11 0 0 0-21 4" />
          <path d="M16 31v8m-3-2 6-4m0 4-6-4m14-2v8m-3-2 6-4m0 4-6-4" />
        </>
      )}
      {kind === 'storm' && (
        <>
          <path d="M12 26h23a7 7 0 0 0 0-14h-1a11 11 0 0 0-21 4" />
          <path d="m26 28-7 10h6l-2 7 9-12h-6l2-5Z" />
        </>
      )}
      {kind === 'unknown' && <circle cx="24" cy="24" r="16" />}
    </svg>
  )
}

function WeatherDetails({ state, refresh }: { state: WeatherState; refresh: () => void }) {
  if (state.status === 'loading' || state.status === 'error') {
    return (
      <div className={styles['weather-widget__empty']}>
        <WeatherIcon className={styles['weather-widget__empty-icon']} kind="cloud" />
        <p className={styles['weather-widget__empty-title']}>
          {state.status === 'loading' ? 'Подключение погоды' : 'Погода недоступна'}
        </p>
        <p className={styles['weather-widget__empty-copy']}>
          {state.status === 'loading' ? 'Получаем прогноз для Харькова' : state.error.message}
        </p>
        {state.status === 'error' && (
          <button className={styles['weather-widget__retry']} onClick={refresh} type="button">
            Повторить
          </button>
        )}
        <WeatherAttribution />
      </div>
    )
  }

  const { data } = state
  const currentPresentation = getWeatherPresentation(
    data.current.weatherCode,
    data.current.isDay,
  )

  return (
    <div className={styles['weather-widget__body']}>
      <div className={styles['weather-widget__current']}>
        <div className={styles['weather-widget__summary']}>
          <WeatherIcon
            className={styles['weather-widget__condition-icon']}
            kind={currentPresentation.icon}
          />
          <div className={styles['weather-widget__temperature-block']}>
            <p className={styles['weather-widget__temperature']}>
              {formatTemperature(data.current.temperatureCelsius)}
            </p>
            <p className={styles['weather-widget__condition']}>
              {currentPresentation.description}
            </p>
          </div>
        </div>
        <dl className={styles['weather-widget__metrics']}>
          <div>
            <dt>Ощущается</dt>
            <dd>{formatTemperature(data.current.apparentTemperatureCelsius)}</dd>
          </div>
          <div>
            <dt>Влажность</dt>
            <dd>{formatPercent(data.current.relativeHumidityPercent)}</dd>
          </div>
          <div>
            <dt>Ветер</dt>
            <dd>
              {data.current.windSpeedKmh === null
                ? '—'
                : `${Math.round(data.current.windSpeedKmh)} ${weatherUnits.windSpeed}`}
            </dd>
          </div>
        </dl>
      </div>

      <div aria-label="Прогноз на три дня" className={styles['weather-widget__forecast']}>
        {data.daily.map((day, index) => {
          const presentation = getWeatherPresentation(day.weatherCode)
          return (
            <div className={styles['weather-widget__day']} key={day.date}>
              <p className={styles['weather-widget__day-name']}>
                {getDayLabel(day.date, index)}
              </p>
              <WeatherIcon
                className={styles['weather-widget__day-icon']}
                kind={presentation.icon}
              />
              <p className={styles['weather-widget__day-temperature']}>
                {formatTemperature(day.temperatureMinCelsius)}
                <span> / </span>
                {formatTemperature(day.temperatureMaxCelsius)}
              </p>
              <p className={styles['weather-widget__precipitation']}>
                Осадки {formatPercent(day.precipitationProbabilityPercent)}
              </p>
            </div>
          )
        })}
      </div>

      <div className={styles['weather-widget__footer']}>
        <p className={styles['weather-widget__status']}>
          {getStatusLabel(state)}
          {state.status === 'stale' && ` · ${state.error.message}`}
          {state.status === 'success' && state.warning && ` · ${state.warning.message}`}
        </p>
        <button
          aria-label="Обновить погоду"
          className={styles['weather-widget__refresh']}
          disabled={state.status === 'refreshing'}
          onClick={refresh}
          type="button"
        >
          Обновить
        </button>
      </div>

      <WeatherAttribution />
    </div>
  )
}

function WeatherDiagnostics({
  diagnostic,
}: {
  diagnostic: WeatherRequestDiagnostic | null
}) {
  if (!diagnostic) {
    return (
      <section aria-label="Диагностика погоды" className={styles['weather-widget__debug']}>
        Диагностика: запрос ещё не начался
      </section>
    )
  }

  return (
    <section aria-label="Диагностика погоды" className={styles['weather-widget__debug']}>
      <p><strong>Этап:</strong> {getDiagnosticStageLabel(diagnostic.stage)}</p>
      <p><strong>URL:</strong> <code>{diagnostic.url}</code></p>
      <p><strong>HTTP:</strong> {diagnostic.httpStatus ?? 'ответ не получен'}</p>
      <p><strong>Время:</strong> {diagnostic.durationMs ?? '—'} мс</p>
      <p><strong>JSON parsing:</strong> {getDiagnosticResultLabel(diagnostic.jsonParsing)}</p>
      <p><strong>Runtime validation:</strong> {getDiagnosticResultLabel(diagnostic.runtimeValidation)}</p>
      <p><strong>Тип ошибки:</strong> {diagnostic.errorType ?? 'нет'}</p>
      <p><strong>Текст ошибки:</strong> {diagnostic.errorMessage ?? 'нет'}</p>
    </section>
  )
}

export function WeatherWidget() {
  const { state, refresh, diagnostic } = useWeather()
  const isWeatherDebug = new URLSearchParams(window.location.search).get('debug') === 'weather'

  return (
    <Panel compact className={styles['weather-widget__panel']} title="Погода · Харьков">
      <div className={styles['weather-widget__content']}>
        <WeatherDetails refresh={refresh} state={state} />
        {isWeatherDebug && <WeatherDiagnostics diagnostic={diagnostic} />}
      </div>
    </Panel>
  )
}
