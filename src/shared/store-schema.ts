export interface StoreSchema {
  settings: {
    storageDir: string
    pomodoro: {
      focusDuration: number
      shortBreak: number
      longBreak: number
      roundsBeforeLongBreak: number
    }
    app: {
      autoStart: boolean
      closeToTray: boolean
      quickCaptureHotkey: string
      maxTabsPerPanel: number
      navHistoryLimit: number
    }
    storageDirHistory: string[]
  }
  timer: {
    status: 'idle' | 'running' | 'paused'
    phase: 'focus' | 'shortBreak' | 'longBreak'
    remainingMs: number
    totalMs: number
    timestamp: string
    round: number
  }
  timerHistory: Array<{
    completedAt: string
    phase: 'focus'
    durationMinutes: number
    planId?: string
  }>
  window: {
    expandedSize: { width: number; height: number }
  }
}

export const storeDefaults: StoreSchema = {
  settings: {
    storageDir: '',
    pomodoro: { focusDuration: 25, shortBreak: 5, longBreak: 15, roundsBeforeLongBreak: 4 },
    app: { autoStart: false, closeToTray: true, quickCaptureHotkey: 'Ctrl+Shift+N', maxTabsPerPanel: 20, navHistoryLimit: 100 },
    storageDirHistory: [],
  },
  timer: { status: 'idle', phase: 'focus', remainingMs: 0, totalMs: 0, timestamp: '', round: 0 },
  timerHistory: [],
  window: {
    expandedSize: { width: 480, height: 680 },
  },
}
