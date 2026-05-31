import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { store, autolaunch } from '@/lib/ipc'

interface PomodoroSettings {
  focusDuration: number
  shortBreak: number
  longBreak: number
  roundsBeforeLongBreak: number
}

interface AppSettings {
  autoStart: boolean
  closeToTray: boolean
  quickCaptureHotkey: string
  maxTabsPerPanel: number
  navHistoryLimit: number
}

interface SettingsState {
  storageDir: string
  storageDirHistory: string[]
  pomodoro: PomodoroSettings
  app: AppSettings
  loaded: boolean
  load: () => Promise<void>
  setStorageDir: (dir: string) => Promise<void>
  updatePomodoro: (updates: Partial<PomodoroSettings>) => Promise<void>
  updateApp: (updates: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  immer((set, get) => ({
    storageDir: '',
    storageDirHistory: [],
    pomodoro: { focusDuration: 25, shortBreak: 5, longBreak: 15, roundsBeforeLongBreak: 4 },
    app: { autoStart: false, closeToTray: true, quickCaptureHotkey: 'Ctrl+Shift+N', maxTabsPerPanel: 20, navHistoryLimit: 100 },
    loaded: false,

    load: async () => {
      const settings = await store.get<{
        storageDir: string
        storageDirHistory: string[]
        pomodoro: PomodoroSettings
        app: AppSettings
      }>('settings')
      if (settings) {
        set((s) => {
          s.storageDir = settings.storageDir || s.storageDir
          s.storageDirHistory = settings.storageDirHistory || []
          if (settings.pomodoro) Object.assign(s.pomodoro, settings.pomodoro)
          if (settings.app) Object.assign(s.app, settings.app)
        })
      }
      set({ loaded: true })
    },

    setStorageDir: async (dir) => {
      set((s) => {
        s.storageDir = dir
        s.storageDirHistory = [dir, ...s.storageDirHistory.filter((d) => d !== dir)].slice(0, 5)
      })
      await store.set('settings.storageDir', dir)
      await store.set('settings.storageDirHistory', get().storageDirHistory)
    },

    updatePomodoro: async (updates) => {
      set((s) => { Object.assign(s.pomodoro, updates) })
      await store.set('settings.pomodoro', get().pomodoro)
    },

    updateApp: async (updates) => {
      set((s) => { Object.assign(s.app, updates) })
      await store.set('settings.app', get().app)
      if (updates.autoStart !== undefined) {
        await (updates.autoStart ? autolaunch.enable() : autolaunch.disable())
      }
    },
  }))
)
