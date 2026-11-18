import type { WeatherIconKind, WeatherPresentation } from './types'

interface WeatherCodeEntry {
  description: string
  icon: WeatherIconKind
}

const weatherCodes: Record<number, WeatherCodeEntry> = {
  0: { description: 'Ясное небо', icon: 'sun' },
  1: { description: 'Преимущественно ясно', icon: 'sun' },
  2: { description: 'Переменная облачность', icon: 'cloud' },
  3: { description: 'Пасмурно', icon: 'cloud' },
  45: { description: 'Туман', icon: 'fog' },
  48: { description: 'Изморозевый туман', icon: 'fog' },
  51: { description: 'Небольшая морось', icon: 'drizzle' },
  53: { description: 'Умеренная морось', icon: 'drizzle' },
  55: { description: 'Сильная морось', icon: 'drizzle' },
  56: { description: 'Небольшая ледяная морось', icon: 'drizzle' },
  57: { description: 'Сильная ледяная морось', icon: 'drizzle' },
  61: { description: 'Небольшой дождь', icon: 'rain' },
  63: { description: 'Умеренный дождь', icon: 'rain' },
  65: { description: 'Сильный дождь', icon: 'rain' },
  66: { description: 'Небольшой ледяной дождь', icon: 'rain' },
  67: { description: 'Сильный ледяной дождь', icon: 'rain' },
  71: { description: 'Небольшой снегопад', icon: 'snow' },
  73: { description: 'Умеренный снегопад', icon: 'snow' },
  75: { description: 'Сильный снегопад', icon: 'snow' },
  77: { description: 'Снежные зёрна', icon: 'snow' },
  80: { description: 'Небольшие ливни', icon: 'rain' },
  81: { description: 'Умеренные ливни', icon: 'rain' },
  82: { description: 'Сильные ливни', icon: 'rain' },
  85: { description: 'Небольшой снег', icon: 'snow' },
  86: { description: 'Сильный снег', icon: 'snow' },
  95: { description: 'Гроза', icon: 'storm' },
  96: { description: 'Гроза с небольшим градом', icon: 'storm' },
  97: { description: 'Сильная гроза', icon: 'storm' },
  99: { description: 'Гроза с сильным градом', icon: 'storm' },
}

export function getWeatherPresentation(
  code: number | null,
  isDay: boolean | null = null,
): WeatherPresentation {
  if (code === null || !Number.isInteger(code)) {
    return { description: 'Нет описания погоды', icon: 'unknown' }
  }

  const entry = weatherCodes[code]
  if (!entry) {
    return { description: 'Неизвестное состояние погоды', icon: 'unknown' }
  }

  if ((code === 0 || code === 1) && isDay === false) {
    return { description: entry.description, icon: 'moon' }
  }

  return entry
}
