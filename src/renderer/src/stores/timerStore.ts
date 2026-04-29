import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { store, notify } from '@/lib/ipc'
import { usePetStore } from './petStore'
import { useSettingsStore } from './settingsStore'
import { fireConfetti } from '@/lib/confetti'
import type { TimerPhase, TimerStatus } from '@/types/timer'

interface TimerStore {
  status: TimerStatus
  phase: TimerPhase
  remainingMs: number
  totalMs: number
  round: number
  todayCount: number
  todayMinutes: number
  start: () => void
  pause: () => void
  resume: () => void
  skip: () => void
  reset: () => void
  tick: () => void
  _completePhase: () => void
  _persist: () => Promise<void>
  _loadPersisted: () => Promise<void>
  _loadHistory: () => Promise<void>
}

export const useTimerStore = create<TimerStore>()(
  immer((set, get) => ({
    status: 'idle',
    phase: 'focus',
    remainingMs: 0,
    totalMs: 0,
    round: 0,
    todayCount: 0,
    todayMinutes: 0,

    start: () => {
      const { phase } = get()
      const settings = useSettingsStore.getState().pomodoro
      const durations: Record<TimerPhase, number> = {
        focus: settings.focusDuration * 60 * 1000,
        shortBreak: settings.shortBreak * 60 * 1000,
        longBreak: settings.longBreak * 60 * 1000,
      }
      const totalMs = durations[phase]
      set({ status: 'running', totalMs, remainingMs: totalMs })
      usePetStore.getState().setState('singleWink')
      get()._persist()
    },

    pause: () => {
      set({ status: 'paused' })
      usePetStore.getState().setState('smile')
      get()._persist()
    },

    resume: () => {
      set({ status: 'running' })
      usePetStore.getState().setState('singleWink')
      get()._persist()
    },

    skip: () => {
      get()._completePhase()
    },

    reset: () => {
      set({ status: 'idle', remainingMs: 0, totalMs: 0 })
      usePetStore.getState().setState('smile')
      get()._persist()
    },

    tick: () => {
      const { status, remainingMs } = get()
      if (status !== 'running') return
      const next = remainingMs - 1000
      if (next <= 0) {
        get()._completePhase()
      } else {
        set({ remainingMs: next })
        if (next % 10000 === 0) get()._persist()
      }
    },

    _completePhase: () => {
      const { phase, round } = get()
      const settings = useSettingsStore.getState().pomodoro

      if (phase === 'focus') {
        const duration = settings.focusDuration
        set((s) => { s.todayCount++; s.todayMinutes += duration })
        store.get<{ completedAt: string; phase: 'focus'; durationMinutes: number }[]>('timerHistory')
          .then((history = []) => {
            history.push({ completedAt: new Date().toISOString(), phase: 'focus', durationMinutes: duration })
            return store.set('timerHistory', history)
          })
      }

      usePetStore.getState().setState('doubleWink')
      fireConfetti()
      notify.show('FunPets', phase === 'focus' ? '专注完成！休息一下吧' : '休息结束，继续加油！')

      const newRound = phase === 'focus' ? round + 1 : round
      const nextPhase: TimerPhase = phase === 'focus'
        ? (newRound % settings.roundsBeforeLongBreak === 0 ? 'longBreak' : 'shortBreak')
        : 'focus'

      const durations: Record<TimerPhase, number> = {
        focus: settings.focusDuration * 60 * 1000,
        shortBreak: settings.shortBreak * 60 * 1000,
        longBreak: settings.longBreak * 60 * 1000,
      }

      set({ status: 'idle', phase: nextPhase, round: newRound, remainingMs: 0, totalMs: 0 })
      get()._persist()

      setTimeout(() => {
        if (usePetStore.getState().state === 'doubleWink') {
          usePetStore.getState().setState('smile')
        }
      }, 3000)
    },

    _persist: async () => {
      const { status, phase, remainingMs, totalMs, round } = get()
      await store.set('timer', {
        status, phase, remainingMs, totalMs, round,
        timestamp: new Date().toISOString(),
      })
    },

    _loadPersisted: async () => {
      const saved = await store.get<{
        status: TimerStatus; phase: TimerPhase; remainingMs: number
        totalMs: number; round: number; timestamp: string
      }>('timer')
      if (!saved || saved.status === 'idle') return

      const elapsed = Date.now() - new Date(saved.timestamp).getTime()
      const remaining = saved.remainingMs - elapsed

      if (remaining <= 0) {
        if (saved.phase === 'focus') {
          const settings = useSettingsStore.getState().pomodoro
          const history = await store.get<{ completedAt: string; phase: 'focus'; durationMinutes: number }[]>('timerHistory') || []
          history.push({ completedAt: new Date().toISOString(), phase: 'focus', durationMinutes: settings.focusDuration })
          await store.set('timerHistory', history)
        }
        await store.set('timer', { status: 'idle', phase: 'focus', remainingMs: 0, totalMs: 0, timestamp: '', round: saved.round })
      } else {
        set({
          status: saved.status === 'running' ? 'running' : 'paused',
          phase: saved.phase,
          remainingMs: remaining,
          totalMs: saved.totalMs,
          round: saved.round,
        })
        if (saved.status === 'running') {
          usePetStore.getState().setState('singleWink')
        }
      }
    },

    _loadHistory: async () => {
      const history = await store.get<{ completedAt: string; durationMinutes: number }[]>('timerHistory')
      if (!history) return
      const today = new Date().toISOString().split('T')[0]
      const todayEntries = history.filter((h) => h.completedAt.startsWith(today))
      set({
        todayCount: todayEntries.length,
        todayMinutes: todayEntries.reduce((sum, h) => sum + h.durationMinutes, 0),
      })
    },
  }))
)
