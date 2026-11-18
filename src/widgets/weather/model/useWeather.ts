import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getWeather,
  isWeatherCache,
  WeatherRequestError,
} from '@/entities/weather'
import type {
  WeatherCache,
  WeatherError,
  WeatherRequestDiagnostic,
  WeatherState,
} from '@/entities/weather'

const CACHE_KEY = 'kharkiv-smart-dashboard:weather:v1'
const CACHE_VERSION = 1
const REFRESH_INTERVAL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12 * 1000

function readCache(): WeatherCache | null {
  try {
    const serializedCache = window.localStorage.getItem(CACHE_KEY)
    if (!serializedCache) return null
    const parsedCache: unknown = JSON.parse(serializedCache)
    return isWeatherCache(parsedCache) ? parsedCache : null
  } catch {
    return null
  }
}

function toWeatherError(error: unknown): WeatherError {
  if (error instanceof WeatherRequestError) {
    return { kind: error.kind, message: error.message }
  }
  return { kind: 'network', message: 'Не удалось обновить погоду' }
}

function initialState(): WeatherState {
  const cached = readCache()
  return cached
    ? { status: 'refreshing', data: cached.data, error: null }
    : { status: 'loading', data: null, error: null }
}

export function useWeather(): {
  state: WeatherState
  refresh: () => void
  diagnostic: WeatherRequestDiagnostic | null
} {
  const [state, setState] = useState<WeatherState>(initialState)
  const [diagnostic, setDiagnostic] = useState<WeatherRequestDiagnostic | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const activeController = useRef<AbortController | null>(null)
  const mounted = useRef(false)

  const refresh = useCallback(() => {
    if (activeController.current) return

    const controller = new AbortController()
    activeController.current = controller
    let didTimeout = false
    setDiagnostic(null)
    setState((current) =>
      current.data
        ? { status: 'refreshing', data: current.data, error: null }
        : { status: 'loading', data: null, error: null },
    )

    const timeoutId = window.setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, REQUEST_TIMEOUT_MS)

    void getWeather(controller.signal, (nextDiagnostic) => {
      if (mounted.current && activeController.current === controller) {
        setDiagnostic(nextDiagnostic)
      }
    })
      .then((data) => {
        if (!mounted.current || activeController.current !== controller) return
        let warning: WeatherError | undefined
        try {
          const cache: WeatherCache = {
            version: CACHE_VERSION,
            savedAt: data.receivedAt,
            data,
          }
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
        } catch {
          warning = {
            kind: 'storage',
            message: 'Погода загружена, но её не удалось сохранить на устройстве',
          }
        }
        setState({ status: 'success', data, error: null, warning })
      })
      .catch((error: unknown) => {
        if (!mounted.current || activeController.current !== controller) return
        if (controller.signal.aborted && !didTimeout) return

        const weatherError = didTimeout
          ? { kind: 'timeout' as const, message: 'Open-Meteo не ответил за 12 секунд' }
          : toWeatherError(error)
        const previousData = stateRef.current.data
        setState(
          previousData
            ? { status: 'stale', data: previousData, error: weatherError }
            : { status: 'error', data: null, error: weatherError },
        )
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        if (activeController.current === controller) {
          activeController.current = null
        }
      })
  }, [])

  useEffect(() => {
    mounted.current = true
    refresh()
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS)

    return () => {
      mounted.current = false
      window.clearInterval(intervalId)
      activeController.current?.abort()
      activeController.current = null
    }
  }, [refresh])

  return { state, refresh, diagnostic }
}
