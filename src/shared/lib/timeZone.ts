const KHARKIV_TIME_ZONES = ['Europe/Kyiv', 'Europe/Kiev'] as const

function isTimeZoneSupported(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone })
    return true
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return false
  }
}

function getKharkivTimeZone(): string {
  const supportedTimeZone = KHARKIV_TIME_ZONES.find(isTimeZoneSupported)
  if (supportedTimeZone) return supportedTimeZone
  throw new Error('This browser does not support a Kharkiv time zone identifier')
}

export const KHARKIV_TIME_ZONE = getKharkivTimeZone()
