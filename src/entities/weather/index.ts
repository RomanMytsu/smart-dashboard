export { getWeather, WeatherRequestError } from './api/getWeather'
export { weatherLocation } from './config/location'
export { getWeatherPresentation } from './model/weatherCode'
export { isWeatherCache, isWeatherData } from './model/validation'
export { weatherUnits } from './model/types'
export type {
  CurrentWeather,
  DailyForecast,
  WeatherCache,
  WeatherData,
  WeatherError,
  WeatherErrorKind,
  WeatherDiagnosticResult,
  WeatherDiagnosticStage,
  WeatherIconKind,
  WeatherPresentation,
  WeatherRequestDiagnostic,
  WeatherState,
  WeatherUnits,
} from './model/types'
