const WEATHER_ICON_CODES = [
  113, 116, 119, 122, 143, 176, 179, 182, 185, 200, 227, 230,
  248, 260, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308,
  311, 314, 317, 320, 323, 326, 329, 332, 335, 338, 350, 353,
  356, 359, 362, 365, 368, 371, 374, 377, 386, 389, 392, 395,
] as const

const weatherIconCodeSet = new Set<number>(WEATHER_ICON_CODES)

export type WeatherIconVariant = 'day' | 'night'

export function isWeatherIconCode(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    weatherIconCodeSet.has(value)
}

export function isWeatherIconVariant(value: unknown): value is WeatherIconVariant {
  return value === 'day' || value === 'night'
}

export function getWeatherIconPath(variant: WeatherIconVariant, code: number): string {
  if (!isWeatherIconVariant(variant) || !isWeatherIconCode(code)) {
    throw new Error('Unsupported weather icon')
  }
  return `/api/weather-icon?variant=${variant}&code=${code}`
}

export function isWeatherIconPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^\/api\/weather-icon\?variant=(day|night)&code=(\d+)$/.exec(value)
  if (!match) return false
  const code = Number(match[2])
  return String(code) === match[2] && isWeatherIconCode(code)
}
