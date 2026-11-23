import { useEffect, useRef, useState } from 'react'
import { getAirAlertHistory } from '@/entities/air-alert'
import type { AirAlertHistory } from '@/entities/air-alert'

const REFRESH_INTERVAL_MS = 30 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12 * 1000

export type AirAlertHistoryState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'available'; data: AirAlertHistory }

export function useAirAlertHistory(): AirAlertHistoryState {
  const [state, setState] = useState<AirAlertHistoryState>({ status: 'loading' })
  const activeController = useRef<AbortController | null>(null)
  const activeTimeout = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true
    const refresh = () => {
      if (!mounted || activeController.current) return
      const controller = new AbortController()
      activeController.current = controller
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      activeTimeout.current = timeoutId
      setState({ status: 'loading' })

      void getAirAlertHistory(controller.signal)
        .then((data) => {
          if (mounted && activeController.current === controller) {
            setState({ status: 'available', data })
          }
        })
        .catch(() => {
          if (mounted && activeController.current === controller) {
            setState({ status: 'unavailable' })
          }
        })
        .finally(() => {
          window.clearTimeout(timeoutId)
          if (activeController.current === controller) {
            activeController.current = null
            activeTimeout.current = null
          }
        })
    }

    refresh()
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => {
      mounted = false
      window.clearInterval(intervalId)
      if (activeTimeout.current !== null) window.clearTimeout(activeTimeout.current)
      activeController.current?.abort()
      activeController.current = null
      activeTimeout.current = null
    }
  }, [])

  return state
}
