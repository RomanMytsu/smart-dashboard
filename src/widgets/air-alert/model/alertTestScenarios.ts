import type {
  AirAlertData,
  AirAlertDetails,
  AirAlertHistory,
} from '@/entities/air-alert'

export type AlertTestScenario =
  | 'missile'
  | 'drone'
  | 'artillery'
  | 'multiple'
  | 'unknown'
  | 'empty'

export interface AirAlertTestData {
  status: AirAlertData
  details: AirAlertDetails
  history: AirAlertHistory
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

function makeAirRaidThreat(threatType: string, minutes: number) {
  return {
    threatType,
    level: 'red' as const,
    startedAt: minutesAgo(minutes),
    sourceMessage: null,
  }
}

function makeAirRaidAlert(threatTypes: Array<{ type: string; minutes: number }>) {
  return {
    alertType: 'air_raid' as const,
    alertLevel: 'red' as const,
    startedAt: minutesAgo(Math.min(...threatTypes.map(({ minutes }) => minutes))),
    finishedAt: null,
    threats: threatTypes.map(({ type, minutes }) => makeAirRaidThreat(type, minutes)),
  }
}

const activeStatus: AirAlertData = { status: 'active', level: 'red' }
const yellowStatus: AirAlertData = { status: 'active', level: 'yellow' }
const partialStatus: AirAlertData = { status: 'partial', level: null }
const inactiveStatus: AirAlertData = { status: 'inactive', level: null }
const emptyHistory: AirAlertHistory = { events: [] }
const lastCompletedAlertFinishedAt = new Date()
const lastCompletedAlertStartedAt = new Date(lastCompletedAlertFinishedAt.getTime() - 85 * 60_000)

const scenarios: Record<AlertTestScenario, AirAlertTestData> = {
  missile: {
    status: activeStatus,
    details: { alerts: [makeAirRaidAlert([{ type: 'ballistic_missiles', minutes: 18 }])] },
    history: emptyHistory,
  },
  drone: {
    status: yellowStatus,
    details: { alerts: [makeAirRaidAlert([{ type: 'drones', minutes: 42 }])] },
    history: emptyHistory,
  },
  artillery: {
    status: partialStatus,
    details: {
      alerts: [{
        alertType: 'artillery_shelling',
        alertLevel: null,
        startedAt: minutesAgo(9),
        finishedAt: null,
        threats: [],
      }],
    },
    history: emptyHistory,
  },
  multiple: {
    status: activeStatus,
    details: {
      alerts: [
        makeAirRaidAlert([
          { type: 'tactic_aircraft_activity', minutes: 38 },
          { type: 'strategic_aircraft_activity', minutes: 34 },
          { type: 'mig31k_departure', minutes: 32 },
          { type: 'ballistic_missiles', minutes: 31 },
          { type: 'cruise_missiles', minutes: 28 },
          { type: 'unspecified_missiles', minutes: 25 },
          { type: 'drones', minutes: 12 },
          { type: 'guided_aerial_bombs', minutes: 9 },
          { type: 'air_defense', minutes: 6 },
        ]),
        {
          alertType: 'artillery_shelling',
          alertLevel: 'red',
          startedAt: minutesAgo(6),
          finishedAt: null,
          threats: [],
        },
      ],
    },
    history: emptyHistory,
  },
  unknown: {
    status: activeStatus,
    details: { alerts: [makeAirRaidAlert([{ type: 'unlisted_threat', minutes: 5 }])] },
    history: emptyHistory,
  },
  empty: {
    status: inactiveStatus,
    details: { alerts: [] },
    history: {
      events: [{
        alertType: 'air_raid',
        startedAt: lastCompletedAlertStartedAt.toISOString(),
        finishedAt: lastCompletedAlertFinishedAt.toISOString(),
      }],
    },
  },
}

const supportedScenarios = new Set<string>(Object.keys(scenarios))

export function getAirAlertTestScenario(): AlertTestScenario | null {
  const testModeAllowed = (
    import.meta.env.DEV && import.meta.env.VITE_ALERT_TEST_MODE === 'true'
  ) || (
    import.meta.env.VITE_ALERT_TEST_MODE === 'true' &&
    import.meta.env.VITE_VERCEL_ENV === 'preview'
  )

  if (!testModeAllowed) return null

  const requestedScenario = new URLSearchParams(window.location.search).get('alertTest')
  return requestedScenario && supportedScenarios.has(requestedScenario)
    ? requestedScenario as AlertTestScenario
    : null
}

export function getAirAlertTestData(scenario: AlertTestScenario): AirAlertTestData {
  return scenarios[scenario]
}
