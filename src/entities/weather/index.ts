export { getWeather, WeatherRequestError } from './api/getWeather'
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
  WeatherRequestDiagnostic,
  WeatherState,
  WeatherUnits,
} from './model/types'
