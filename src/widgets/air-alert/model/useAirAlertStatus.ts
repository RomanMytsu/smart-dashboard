import { useCallback, useEffect, useRef, useState } from 'react'
import { getAirAlertStatus } from '@/entities/air-alert'
import type { AirAlertData } from '@/entities/air-alert'

const REFRESH_INTERVAL_MS = 60_000
const REQUEST_TIMEOUT_MS = 10_000

export type AirAlertWidgetState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'available'; data: AirAlertData }

export function useAirAlertStatus(): AirAlertWidgetState {
  const [state, setState] = useState<AirAlertWidgetState>({ status: 'loading' })
  const activeController = useRef<AbortController | null>(null)
  const mounted = useRef(false)

  const refresh = useCallback(() => {
    if (activeController.current) return

    const controller = new AbortController()
    activeController.current = controller
    let didTimeout = false
    const timeoutId = window.setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, REQUEST_TIMEOUT_MS)

    void getAirAlertStatus(controller.signal)
      .then((data) => {
        if (mounted.current && activeController.current === controller) {
          setState({ status: 'available', data })
        }
      })
      .catch(() => {
        if (!mounted.current || activeController.current !== controller) return
        if (controller.signal.aborted && !didTimeout) return
        setState({ status: 'unavailable' })
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        if (activeController.current === controller) activeController.current = null
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

  return state
}
