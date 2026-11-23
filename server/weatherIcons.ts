import {
  getWeatherIconPath,
  isWeatherIconCode,
  isWeatherIconVariant,
} from '../src/shared/lib/weatherIcons.js'

const WEATHER_ICON_ORIGIN = 'https://cdn.weatherapi.com'
const WEATHER_ICON_PATH_PATTERN = /^\/weather\/64x64\/(day|night)\/(\d+)\.png$/

export function normalizeWeatherApiIcon(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const candidate = value.startsWith('//') ? `https:${value}` : value

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (
    url.origin !== WEATHER_ICON_ORIGIN ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) return null

  const match = WEATHER_ICON_PATH_PATTERN.exec(url.pathname)
  if (!match) return null
  const code = Number(match[2])
  if (
    String(code) !== match[2] ||
    !isWeatherIconVariant(match[1]) ||
    !isWeatherIconCode(code)
  ) return null

  return getWeatherIconPath(match[1], code)
}
