import { useEffect, useState } from 'react'
import type {
  AirAlertDetails,
  AirAlertHistoryEvent,
} from '@/entities/air-alert'
import { Panel } from '@/shared/ui/panel'
import { useAirAlertDetails } from '../model/useAirAlertDetails'
import { useAirAlertHistory } from '../model/useAirAlertHistory'
import { useAirAlertStatus } from '../model/useAirAlertStatus'
import {
  getAirAlertTestData,
  getAirAlertTestScenario,
} from '../model/alertTestScenarios'
import styles from './AirAlertWidget.module.scss'

const KYIV_TIME_ZONE = 'Europe/Kyiv'

function getDateInKyiv(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KYIV_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const fields: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') fields[part.type] = part.value
  }
  return `${fields.year}-${fields.month}-${fields.day}`
}

function formatKyivTime(value: string, includeDate: boolean): string {
  const date = new Date(value)
  const time = new Intl.DateTimeFormat('ru-RU', {
    timeZone: KYIV_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  if (!includeDate) return time
  const dateLabel = new Intl.DateTimeFormat('ru-RU', {
    timeZone: KYIV_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(date)
  return `${dateLabel} ${time}`
}

function getLatestEvent(events: AirAlertHistoryEvent[]): AirAlertHistoryEvent | null {
  return events.reduce<AirAlertHistoryEvent | null>((latest, event) => {
    if (!latest || Date.parse(event.startedAt) > Date.parse(latest.startedAt)) return event
    return latest
  }, null)
}

interface ThreatLine {
  id: string
  label: string
  startedAt: string | null
}

const threatLabels = new Map<string, string>([
  ['tactic_aircraft_activity', 'Активность тактической авиации'],
  ['strategic_aircraft_activity', 'Активность стратегической авиации'],
  ['mig31k_departure', 'Взлёт МиГ-31К'],
  ['ballistic_missiles', 'Ракетная угроза'],
  ['cruise_missiles', 'Ракетная угроза'],
  ['unspecified_missiles', 'Ракетная угроза'],
  ['drones', 'Угроза применения БПЛА'],
  ['guided_aerial_bombs', 'Угроза применения управляемых авиабомб'],
  ['air_defense', 'Работа ПВО'],
])

function getThreatLine(
  threat: AirAlertDetails['alerts'][number]['threats'][number],
  alertStartedAt: string,
  alertIndex: number,
  threatIndex: number,
): ThreatLine | null {
  const label = threatLabels.get(threat.threatType)
  if (!label) return null

  return {
    id: `${alertIndex}-${threatIndex}-${threat.threatType}`,
    label,
    startedAt: threat.startedAt ?? alertStartedAt,
  }
}

function getThreatLines(details: AirAlertDetails | null): ThreatLine[] {
  if (!details) return []
  const lines: ThreatLine[] = []
  details.alerts.forEach((alert, alertIndex) => {
    if (alert.alertType === 'artillery_shelling') {
      lines.push({
        id: `${alertIndex}-artillery`,
        label: 'Угроза артобстрела',
        startedAt: alert.startedAt,
      })
      return
    }
    alert.threats.forEach((threat, threatIndex) => {
      const line = getThreatLine(threat, alert.startedAt, alertIndex, threatIndex)
      if (line) lines.push(line)
    })
  })

  return lines
}

type AlertCardLevel = 'green' | 'red' | 'yellow' | 'orange'

function getAlertCardLevel(
  state: ReturnType<typeof useAirAlertStatus>,
  details: ReturnType<typeof useAirAlertDetails>,
): AlertCardLevel | null {
  if (state.status !== 'available') return null

  if (state.data.status === 'inactive') return 'green'
  if (state.data.status === 'active') return state.data.level
  if (state.data.status !== 'partial' || details.status !== 'available') return null

  return details.data.alerts.some(
    (alert) => alert.finishedAt === null && alert.alertType === 'artillery_shelling',
  ) ? 'orange' : null
}

function formatDuration(startedAt: string, now: Date): string | null {
  const elapsedMinutes = Math.floor((now.getTime() - Date.parse(startedAt)) / 60_000)
  if (elapsedMinutes < 0) return null
  const days = Math.floor(elapsedMinutes / (24 * 60))
  const hours = Math.floor((elapsedMinutes % (24 * 60)) / 60)
  const minutes = elapsedMinutes % 60
  if (days > 0) return `${days} д ${hours} ч ${minutes} мин`
  return `${hours} ч ${minutes} мин`
}

function getLastCompletedAirRaidDuration(
  history: ReturnType<typeof useAirAlertHistory>,
  now: Date,
): string | null {
  if (history.status !== 'available') return null

  const completedEvents = history.data.events.filter((event) => {
    if (event.alertType !== 'air_raid' || event.finishedAt === null) return false
    const startedAt = Date.parse(event.startedAt)
    const finishedAt = Date.parse(event.finishedAt)
    return Number.isFinite(startedAt) &&
      Number.isFinite(finishedAt) &&
      finishedAt >= startedAt &&
      finishedAt <= now.getTime()
  })
  const latest = completedEvents.reduce<AirAlertHistoryEvent | null>(
    (current, event) => !current ||
      Date.parse(event.finishedAt ?? '') > Date.parse(current.finishedAt ?? '')
      ? event
      : current,
    null,
  )

  return latest?.finishedAt
    ? formatDuration(latest.startedAt, new Date(latest.finishedAt))
    : null
}

function getThreatTiming(startedAt: string | null, now: Date): string[] {
  if (!startedAt) return ['Время начала временно недоступно']
  const started = new Date(startedAt)
  if (Number.isNaN(started.getTime()) || started.getTime() > now.getTime()) {
    return ['Время начала временно недоступно']
  }
  const duration = formatDuration(startedAt, now)
  if (duration === null) return ['Время начала временно недоступно']
  return [
    `Начало: ${formatKyivTime(startedAt, getDateInKyiv(started) !== getDateInKyiv(now))}`,
    `Длится: ${duration}`,
  ]
}

function getTimingLines(
  state: ReturnType<typeof useAirAlertStatus>,
  history: ReturnType<typeof useAirAlertHistory>,
  details: ReturnType<typeof useAirAlertDetails>,
  now: Date,
  hasThreatLines: boolean,
): string[] {
  if (state.status === 'available' && state.data.status === 'inactive') {
    const duration = getLastCompletedAirRaidDuration(history, now)
    return duration ? [`Последняя тревога длилась: ${duration}`] : []
  }
  if (state.status !== 'available') {
    return [history.status === 'loading' ? 'Загружаем время события…' : 'Время события временно недоступно']
  }
  if (hasThreatLines) return []

  if (state.data.status === 'active' || state.data.status === 'partial') {
    const activeAlerts = details.status === 'available'
      ? details.data.alerts.filter((alert) => alert.finishedAt === null)
      : []
    const latestActiveAlert = activeAlerts.reduce<typeof activeAlerts[number] | null>(
      (latest, alert) => !latest || Date.parse(alert.startedAt) > Date.parse(latest.startedAt)
        ? alert
        : latest,
      null,
    )
    const latestHistoryEvent = history.status === 'available'
      ? getLatestEvent(history.data.events.filter((event) => event.alertType === 'air_raid'))
      : null
    const startedAt = latestActiveAlert?.startedAt ?? latestHistoryEvent?.startedAt
    if (!startedAt) {
      return [history.status === 'loading' ? 'Загружаем время события…' : 'Время события временно недоступно']
    }
    if (Date.parse(startedAt) > now.getTime()) return ['Время события временно недоступно']
    const duration = formatDuration(startedAt, now)
    if (duration === null) return ['Время события временно недоступно']
    const startedDate = getDateInKyiv(new Date(startedAt))
    return [
      `Начало: ${formatKyivTime(startedAt, startedDate !== getDateInKyiv(now))}`,
      `Длится: ${duration}`,
    ]
  }

  return []
}

interface StatusCopy {
  label: string
  description: string
  style: string
}

function getStatusCopy(state: ReturnType<typeof useAirAlertStatus>): StatusCopy {
  if (state.status === 'loading') {
    return {
      label: 'Проверяем статус',
      description: 'Получаем данные о воздушной тревоге в Харькове',
      style: 'loading',
    }
  }

  if (state.status === 'unavailable') {
    return {
      label: 'Данные временно недоступны',
      description: 'Не удалось получить статус воздушной тревоги',
      style: 'unavailable',
    }
  }

  if (state.data.status === 'partial') {
    return {
      label: 'Частичная тревога',
      description: 'Тревога объявлена не во всей городской громаде',
      style: 'partial',
    }
  }

  if (state.data.status === 'inactive') {
    return {
      label: 'Тревога не объявлена',
      description: '',
      style: 'clear',
    }
  }

  return state.data.level === 'yellow'
    ? {
        label: 'Жёлтая тревога',
        description: '',
        style: 'yellow',
      }
    : {
        label: 'Красная тревога',
        description: '',
        style: 'active',
      }
}

export function AirAlertWidget() {
  const liveState = useAirAlertStatus()
  const liveHistory = useAirAlertHistory()
  const liveDetails = useAirAlertDetails()
  const testScenario = getAirAlertTestScenario()
  const testData = testScenario ? getAirAlertTestData(testScenario) : null
  const state = testData
    ? { status: 'available' as const, data: testData.status }
    : liveState
  const history = testData
    ? { status: 'available' as const, data: testData.history }
    : liveHistory
  const details = testData
    ? { status: 'available' as const, data: testData.details }
    : liveDetails
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])
  const content = getStatusCopy(state)
  const cardLevel = getAlertCardLevel(state, details)
  const threatLines = state.status === 'available' &&
    (state.data.status === 'active' || state.data.status === 'partial') &&
    details.status === 'available'
    ? getThreatLines(details.data)
    : []
  const hasThreatLines = threatLines.length > 0
  const timingLines = getTimingLines(state, history, details, now, hasThreatLines)
  const shouldShowPartialDescription = state.status === 'available' &&
    state.data.status === 'partial'

  return (
    <Panel
      title="Воздушная тревога"
      className={cardLevel ? styles[`air-alert-widget--${cardLevel}`] : undefined}
      titleClassName={styles['air-alert-widget__heading']}
      compact
    >
      <div className={styles['air-alert-widget__content']}>
        {testData && (
          <p className={styles['air-alert-widget__test-mode']}>ТЕСТОВЫЙ РЕЖИМ</p>
        )}
        <div
          aria-label={content.label}
          className={`${styles['air-alert-widget__status']} ${styles[`air-alert-widget__status--${content.style}`]}`}
          role="status"
        >
          <span aria-hidden="true" className={styles['air-alert-widget__marker']} />
          <span>{content.label}</span>
        </div>
        {content.description && (!hasThreatLines || shouldShowPartialDescription) && (
          <p className={styles['air-alert-widget__description']}>
            {content.description}
          </p>
        )}
        {hasThreatLines && (
          <ul aria-label="Текущие угрозы" className={styles['air-alert-widget__threats']}>
            {threatLines.map((threat) => (
              <li className={styles['air-alert-widget__threat']} key={threat.id}>
                <span aria-hidden="true" className={styles['air-alert-widget__threat-marker']} />
                <span className={styles['air-alert-widget__threat-content']}>
                  <span className={styles['air-alert-widget__threat-label']}>{threat.label}</span>
                  <span className={styles['air-alert-widget__threat-timing']}>
                    {getThreatTiming(threat.startedAt, now).map((line) => (
                      <span className={styles['air-alert-widget__threat-time']} key={`${threat.id}-${line}`}>{line}</span>
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div aria-label="Время события тревоги" className={styles['air-alert-widget__timing']}>
          {timingLines.map((line) => <p key={line}>{line}</p>)}
        </div>
      </div>
    </Panel>
  )
}
