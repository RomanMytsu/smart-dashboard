export type AirAlertData = {
  status: 'active' | 'partial' | 'inactive'
  level: 'red' | 'yellow' | null
}

export type AirAlertType = 'air_raid' | 'artillery_shelling'
export type AirAlertLevel = 'red' | 'yellow' | null

export interface AirAlertHistoryEvent {
  alertType: AirAlertType
  startedAt: string
  finishedAt: string | null
}

export interface AirAlertHistory {
  events: AirAlertHistoryEvent[]
}

export interface AirAlertThreat {
  threatType: string
  level: AirAlertLevel
  startedAt: string | null
  sourceMessage: string | null
}

export interface AirAlertDetail {
  alertType: AirAlertType
  alertLevel: AirAlertLevel
  startedAt: string
  finishedAt: string | null
  threats: AirAlertThreat[]
}

export interface AirAlertDetails {
  alerts: AirAlertDetail[]
}
