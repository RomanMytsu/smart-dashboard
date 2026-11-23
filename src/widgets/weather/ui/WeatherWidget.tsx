import { useState } from 'react'
import { weatherUnits } from '@/entities/weather'
import type {
  WeatherRequestDiagnostic,
  WeatherState,
} from '@/entities/weather'
import { Panel } from '@/shared/ui/panel'
import { KHARKIV_TIME_ZONE } from '@/shared/lib/timeZone'
import styles from './WeatherWidget.module.scss'

function createDateFormatter(
  options: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('ru-RU', {
    ...options,
    timeZone: KHARKIV_TIME_ZONE,
  })
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
      <a href="https://www.weatherapi.com/" rel="noreferrer" target="_blank">
        Погода: WeatherAPI
      </a>
      <a href="https://www.geonames.org/" rel="noreferrer" target="_blank">
        Город: GeoNames
      </a>
    </div>
  )
}

function WeatherIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 48 48"
    >
      <path d="M12 34h23a8 8 0 0 0 0-16h-1a12 12 0 0 0-23 4 6 6 0 0 0 1 12Z" />
    </svg>
  )
}

function WeatherConditionImage({
  src,
  alt,
  className,
}: {
  src: string | null
  alt: string
  className: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return <WeatherIcon className={className} />
  }
  return (
    <img
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      src={src}
    />
  )
}

function WeatherDetails({ state, refresh }: { state: WeatherState; refresh: () => void }) {
  if (state.status === 'loading' || state.status === 'error') {
    return (
      <div className={styles['weather-widget__empty']}>
        <WeatherIcon className={styles['weather-widget__empty-icon']} />
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
  return (
    <div className={styles['weather-widget__body']}>
      <div className={styles['weather-widget__current']}>
        <div className={styles['weather-widget__summary']}>
          <WeatherConditionImage
            alt={data.current.conditionText ?? 'Погодные условия'}
            className={styles['weather-widget__condition-icon']}
            key={data.current.conditionIconUrl ?? 'current-weather-fallback'}
            src={data.current.conditionIconUrl}
          />
          <div className={styles['weather-widget__temperature-block']}>
            <p className={styles['weather-widget__temperature']}>
              {formatTemperature(data.current.temperatureCelsius)}
            </p>
            <p className={styles['weather-widget__condition']}>
              {data.current.conditionText ?? 'Условия не указаны'}
            </p>
          </div>
        </div>
        <dl className={styles['weather-widget__metrics']}>
          <div className={styles['weather-widget__metric--feels-like']}>
            <dt>Ощущается как</dt>
            <dd>{formatTemperature(data.current.apparentTemperatureCelsius)}</dd>
          </div>
          <div>
            <dt>Влажность</dt>
            <dd>{formatPercent(data.current.relativeHumidityPercent)}</dd>
          </div>
          <div>
            <dt>Ветер</dt>
            <dd>
              {data.current.windSpeedMetersPerSecond === null
                ? '—'
                : `${data.current.windSpeedMetersPerSecond.toFixed(1)} м/с`}
            </dd>
          </div>
        </dl>
      </div>

      <div aria-label="Прогноз на три дня" className={styles['weather-widget__forecast']}>
        {data.daily.map((day, index) => {
          return (
            <div className={styles['weather-widget__day']} key={day.date}>
              <p className={styles['weather-widget__day-name']}>
                {getDayLabel(day.date, index)}
              </p>
              <WeatherConditionImage
                alt={day.conditionText ?? 'Погодные условия'}
                className={styles['weather-widget__day-icon']}
                key={day.conditionIconUrl ?? `${day.date}-weather-fallback`}
                src={day.conditionIconUrl}
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

export function WeatherWidget({
  state,
  refresh,
  diagnostic,
}: {
  state: WeatherState
  refresh: () => void
  diagnostic: WeatherRequestDiagnostic | null
}) {
  const isWeatherDebug = new URLSearchParams(window.location.search).get('debug') === 'weather'

  return (
    <Panel
      compact
      className={styles['weather-widget__panel']}
      title="Погода"
      titleClassName={styles['weather-widget__title']}
    >
      <div className={styles['weather-widget__content']}>
        <WeatherDetails refresh={refresh} state={state} />
        {isWeatherDebug && <WeatherDiagnostics diagnostic={diagnostic} />}
      </div>
    </Panel>
  )
}
