import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { store, notify } from '@/lib/ipc'
import { usePetStore } from './petStore'
import { useSettingsStore } from './settingsStore'
import { useToastStore } from './toastStore'
import { fireConfetti } from '@/lib/confetti'
import type { TimerPhase, TimerStatus, TimerHistoryEntry } from '@/types/timer'

interface TimerStore {
  status: TimerStatus
  phase: TimerPhase
  remainingMs: number
  totalMs: number
  round: number
  todayCount: number
  todayMinutes: number
  _persistVersion: number
  _lastTickAt: number
  pendingPlanId: string | null
  history: TimerHistoryEntry[]
  lastSelectedPlanId: string | null
  pendingStartPlanId: string | null
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
  setPendingPlanId: (id: string | null) => void
  startWithPlan: (planId: string) => void
  getPlanFocusMinutes: (planId: string) => number
  updateHistoryEntry: (id: string, updates: { completedAt?: string; durationMinutes?: number; planId?: string | null }) => void
  deleteHistoryEntry: (id: string) => void
  _recalcTodayStats: () => void
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
    _persistVersion: 0,
    _lastTickAt: 0,
    pendingPlanId: null,
    history: [],
    lastSelectedPlanId: null,
    pendingStartPlanId: null,

    start: () => {
      const { phase } = get()
      const settings = useSettingsStore.getState().pomodoro
      const durations: Record<TimerPhase, number> = {
        focus: settings.focusDuration * 60 * 1000,
        shortBreak: settings.shortBreak * 60 * 1000,
        longBreak: settings.longBreak * 60 * 1000,
      }
      const totalMs = durations[phase]
      set((s) => {
        s.status = 'running'
        s.totalMs = totalMs
        s.remainingMs = totalMs
        s._lastTickAt = Date.now()
        s._persistVersion++
      })
      usePetStore.getState().setState('singleWink')
      get()._persist()
      useToastStore.getState().show('启动番茄钟')
    },

    pause: () => {
      set((s) => { s.status = 'paused'; s._persistVersion++ })
      usePetStore.getState().setState('smile')
      get()._persist()
    },

    resume: () => {
      set((s) => { s.status = 'running'; s._lastTickAt = Date.now(); s._persistVersion++ })
      usePetStore.getState().setState('singleWink')
      get()._persist()
    },

    skip: () => {
      get()._completePhase()
    },

    reset: () => {
      set((s) => { s.status = 'idle'; s.remainingMs = 0; s.totalMs = 0; s._persistVersion++ })
      usePetStore.getState().setState('smile')
      usePetStore.getState().setTimerBubblePinned(false)
      get()._persist()
    },

    tick: () => {
      const { status, remainingMs, _lastTickAt } = get()
      if (status !== 'running') return
      const now = Date.now()
      const elapsed = _lastTickAt ? now - _lastTickAt : 1000
      const next = remainingMs - elapsed
      set({ remainingMs: Math.max(next, 0), _lastTickAt: now })
      if (next <= 0) {
        get()._completePhase()
      } else {
        if (Math.floor(remainingMs / 10000) !== Math.floor(next / 10000)) {
          get()._persist()
        }
      }
    },

    _completePhase: () => {
      const { phase, round, totalMs, remainingMs, pendingPlanId } = get()
      const settings = useSettingsStore.getState().pomodoro

      if (phase === 'focus') {
        const actualMinutes = Math.max(1, Math.round((totalMs - remainingMs) / 60000))
        set((s) => { s.todayCount++; s.todayMinutes += actualMinutes })
        const entry: TimerHistoryEntry = {
          id: crypto.randomUUID(),
          completedAt: new Date().toISOString(),
          phase: 'focus',
          durationMinutes: actualMinutes,
          ...(pendingPlanId ? { planId: pendingPlanId } : {}),
        }
        set((s) => { s.history.push(entry) })
        store.get<TimerHistoryEntry[]>('timerHistory')
          .then((history = []) => {
            history.push(entry)
            return store.set('timerHistory', history)
          })
      }

      usePetStore.getState().setState('doubleWink')
      usePetStore.getState().setTimerBubblePinned(false)
      fireConfetti()
      notify.show('FunBuddy', phase === 'focus' ? '专注完成！休息一下吧' : '休息结束，继续加油！')

      const newRound = phase === 'focus' ? round + 1 : round
      const nextPhase: TimerPhase = phase === 'focus'
        ? (newRound % settings.roundsBeforeLongBreak === 0 ? 'longBreak' : 'shortBreak')
        : 'focus'

      set((s) => {
        s.status = 'idle'
        s.phase = nextPhase
        s.round = newRound
        s.remainingMs = 0
        s.totalMs = 0
        s.pendingPlanId = null
        s._persistVersion++
      })
      get()._persist()

      setTimeout(() => {
        if (usePetStore.getState().state === 'doubleWink') {
          usePetStore.getState().setState('smile')
        }
      }, 3000)
    },

    _persist: async () => {
      const version = get()._persistVersion
      const { status, phase, remainingMs, totalMs, round } = get()
      if (get()._persistVersion !== version) return
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

      let remaining: number
      if (saved.status === 'running') {
        const elapsed = Date.now() - new Date(saved.timestamp).getTime()
        remaining = saved.remainingMs - elapsed
      } else {
        remaining = saved.remainingMs
      }

      if (remaining <= 0) {
        if (saved.phase === 'focus') {
          const settings = useSettingsStore.getState().pomodoro
          const newRound = saved.round + 1
          const nextPhase: TimerPhase = newRound % settings.roundsBeforeLongBreak === 0
            ? 'longBreak' : 'shortBreak'
          const history = await store.get<{ completedAt: string; phase: 'focus'; durationMinutes: number }[]>('timerHistory') || []
          history.push({ id: crypto.randomUUID(), completedAt: new Date().toISOString(), phase: 'focus', durationMinutes: settings.focusDuration })
          await store.set('timerHistory', history)
          await store.set('timer', { status: 'idle', phase: nextPhase, remainingMs: 0, totalMs: 0, timestamp: '', round: newRound })
        } else {
          await store.set('timer', { status: 'idle', phase: 'focus', remainingMs: 0, totalMs: 0, timestamp: '', round: saved.round })
        }
      } else {
        set({
          status: saved.status === 'running' ? 'running' : 'paused',
          phase: saved.phase,
          remainingMs: remaining,
          totalMs: saved.totalMs,
          round: saved.round,
          ...(saved.status === 'running' ? { _lastTickAt: Date.now() } : {}),
        })
        if (saved.status === 'running') {
          usePetStore.getState().setState('singleWink')
        }
      }
    },

    _loadHistory: async () => {
      const history = await store.get<TimerHistoryEntry[]>('timerHistory')
      if (!history) return
      // Migrate legacy entries without id
      let needsPersist = false
      for (const entry of history) {
        if (!entry.id) {
          entry.id = crypto.randomUUID()
          needsPersist = true
        }
      }
      if (needsPersist) {
        await store.set('timerHistory', history)
      }
      set({ history })
      get()._recalcTodayStats()
    },

    setPendingPlanId: (id) => set({ pendingPlanId: id }),

    startWithPlan: (planId) => {
      set({ pendingPlanId: planId, lastSelectedPlanId: planId })
      get().start()
    },

    updateHistoryEntry: (id, updates) => {
      set((s) => {
        const entry = s.history.find((h) => h.id === id)
        if (!entry) return
        if (updates.completedAt !== undefined) entry.completedAt = updates.completedAt
        if (updates.durationMinutes !== undefined) entry.durationMinutes = updates.durationMinutes
        if (updates.planId !== undefined) {
          if (updates.planId === null) {
            delete entry.planId
          } else {
            entry.planId = updates.planId
          }
        }
      })
      const history = get().history
      store.set('timerHistory', [...history])
      get()._recalcTodayStats()
    },

    deleteHistoryEntry: (id) => {
      set((s) => {
        s.history = s.history.filter((h) => h.id !== id)
      })
      const history = get().history
      store.set('timerHistory', [...history])
      get()._recalcTodayStats()
    },

    _recalcTodayStats: () => {
      const today = new Date().toISOString().split('T')[0]
      const todayEntries = get().history.filter((h) => h.completedAt.startsWith(today))
      set({
        todayCount: todayEntries.length,
        todayMinutes: todayEntries.reduce((sum, h) => sum + h.durationMinutes, 0),
      })
    },

    getPlanFocusMinutes: (planId) => {
      return get().history
        .filter((h) => h.planId === planId)
        .reduce((sum, h) => sum + h.durationMinutes, 0)
    },
  }))
)
