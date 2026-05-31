export type TimerStatus = 'idle' | 'running' | 'paused'
export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak'

export interface TimerState {
  status: TimerStatus
  phase: TimerPhase
  remainingMs: number
  totalMs: number
  round: number
}

export interface TimerHistoryEntry {
  id: string
  completedAt: string
  phase: 'focus'
  durationMinutes: number
  planId?: string
}
