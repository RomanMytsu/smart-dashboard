import { useEffect, useRef, useState } from 'react'
import { getAirAlertDetails } from '@/entities/air-alert'
import type { AirAlertDetails } from '@/entities/air-alert'

const REFRESH_INTERVAL_MS = 60_000
const REQUEST_TIMEOUT_MS = 12_000

export type AirAlertDetailsState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'available'; data: AirAlertDetails }

export function useAirAlertDetails(): AirAlertDetailsState {
  const [state, setState] = useState<AirAlertDetailsState>({ status: 'loading' })
  const activeController = useRef<AbortController | null>(null)

  useEffect(() => {
    let mounted = true
    const refresh = () => {
      if (!mounted || activeController.current) return
      const controller = new AbortController()
      activeController.current = controller
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      void getAirAlertDetails(controller.signal)
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
          if (activeController.current === controller) activeController.current = null
        })
    }

    refresh()
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => {
      mounted = false
      window.clearInterval(intervalId)
      activeController.current?.abort()
      activeController.current = null
    }
  }, [])

  return state
}
