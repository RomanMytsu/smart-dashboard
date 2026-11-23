import { useEffect, useRef, useState } from 'react'
import {
  AIR_QUALITY_CACHE_KEY,
  AIR_QUALITY_REFRESH_INTERVAL_MS,
  DISPLAYABLE_DATA_MAX_AGE_MS,
  fetchAirQuality,
  getObservedAtTimestamp,
  readCachedAirQuality,
  serializeAirQualityCache,
  stateForAirQualityData,
} from './airQuality'
import type { AirQualityData, AirQualityState } from './airQuality'

const REQUEST_TIMEOUT_MS = 12 * 1000
const FRESHNESS_CHECK_INTERVAL_MS = 60 * 1000

export function useAirQuality(): AirQualityState {
  const latestData = useRef<AirQualityData | null>(null)
  const activeController = useRef<AbortController | null>(null)
  const activeTimeoutId = useRef<number | null>(null)
  const [state, setState] = useState<AirQualityState>(() => {
    const cached = readCachedAirQuality()
    latestData.current = cached
    return cached
      ? stateForAirQualityData(cached, Date.now())
      : { status: 'loading', data: null, error: null }
  })

  useEffect(() => {
    let mounted = true

    const refresh = () => {
      if (!mounted || activeController.current) return

      const controller = new AbortController()
      activeController.current = controller
      let didTimeout = false
      const timeoutId = window.setTimeout(() => {
        didTimeout = true
        controller.abort()
      }, REQUEST_TIMEOUT_MS)
      activeTimeoutId.current = timeoutId

      void fetchAirQuality(controller.signal)
        .then((data) => {
          if (!mounted || activeController.current !== controller) return
          const now = Date.now()
          const previous = latestData.current
          const receivedAt = getObservedAtTimestamp(data.observedAt, data.observedAtUtcOffsetSeconds)
          const previousObservedAt = previous
            ? getObservedAtTimestamp(previous.observedAt, previous.observedAtUtcOffsetSeconds)
            : null

          if (previous && receivedAt !== null && previousObservedAt !== null && receivedAt < previousObservedAt) {
            setState(stateForAirQualityData(previous, now, 'Сервис вернул более старые данные'))
            return
          }

          latestData.current = data
          if (now - (receivedAt ?? now) <= DISPLAYABLE_DATA_MAX_AGE_MS) {
            try {
              window.localStorage.setItem(AIR_QUALITY_CACHE_KEY, serializeAirQualityCache(data))
            } catch {
              // Keep the successfully received values available in memory when storage is unavailable.
            }
          }
          setState(stateForAirQualityData(data, now))
        })
        .catch((error: unknown) => {
          if (!mounted || activeController.current !== controller) return
          const message = didTimeout
            ? 'Сервис качества воздуха не ответил за 12 секунд'
            : error instanceof Error ? error.message : 'Не удалось загрузить качество воздуха'
          const previous = latestData.current
          setState(previous
            ? stateForAirQualityData(previous, Date.now(), message)
            : { status: 'error', data: null, error: message })
        })
        .finally(() => {
          window.clearTimeout(timeoutId)
          if (activeController.current === controller) {
            activeController.current = null
            activeTimeoutId.current = null
          }
        })
    }

    refresh()
    const refreshIntervalId = window.setInterval(refresh, AIR_QUALITY_REFRESH_INTERVAL_MS)
    const freshnessIntervalId = window.setInterval(() => {
      if (!mounted) return
      setState((current) => {
        const data = current.data ?? latestData.current
        if (!data) return current
        const message = current.status === 'stale'
          ? current.error
          : current.status === 'success' ? current.warning : null
        return stateForAirQualityData(data, Date.now(), message)
      })
    }, FRESHNESS_CHECK_INTERVAL_MS)

    return () => {
      mounted = false
      window.clearInterval(refreshIntervalId)
      window.clearInterval(freshnessIntervalId)
      if (activeController.current) {
        if (activeTimeoutId.current !== null) window.clearTimeout(activeTimeoutId.current)
        activeController.current.abort()
        activeController.current = null
        activeTimeoutId.current = null
      }
    }
  }, [])

  return state
}
