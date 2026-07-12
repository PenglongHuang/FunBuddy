import { useEffect, useRef } from 'react'
import { useTimerStore } from '@/stores/timerStore'

export function useTimer() {
  const tick = useTimerStore((s) => s.tick)
  const status = useTimerStore((s) => s.status)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    if (window.location.hash === '#quick-capture') return

    if (status === 'running') {
      intervalRef.current = setInterval(tick, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status, tick])
}
