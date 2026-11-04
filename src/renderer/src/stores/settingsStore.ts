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
  tocMaxLevel: number
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
    app: { autoStart: false, closeToTray: true, quickCaptureHotkey: 'Ctrl+Shift+N', maxTabsPerPanel: 20, navHistoryLimit: 100, tocMaxLevel: 3 },
    loaded: false,

    load: async () => {
      const settings = await store.get<{
        storageDir?: string
        storageDirHistory?: string[]
        pomodoro?: Partial<PomodoroSettings>
        app?: Partial<AppSettings>
      }>('settings')
      const legacyNotePrefs = await store.get<{ tocMaxLevel?: number }>('notePrefs')
      const tocMaxLevel = settings?.app?.tocMaxLevel ?? legacyNotePrefs?.tocMaxLevel ?? 3
      set((s) => {
        if (settings) {
          s.storageDir = settings.storageDir || s.storageDir
          s.storageDirHistory = settings.storageDirHistory || []
          if (settings.pomodoro) Object.assign(s.pomodoro, settings.pomodoro)
          if (settings.app) Object.assign(s.app, settings.app)
        }
        s.app.tocMaxLevel = Math.max(1, Math.min(6, tocMaxLevel))
        s.loaded = true
      })
      if (settings?.app?.tocMaxLevel === undefined) {
        await store.set('settings.app', get().app)
      }
    },

    setStorageDir: async (dir) => {
      // 特权键 settings.storageDir(History) 已拒绝渲染端直写,
      // 由主进程校验令牌/历史后落盘;成功后再更新本地镜像
      await store.setStorageDir(dir)
      set((s) => {
        s.storageDir = dir
        s.storageDirHistory = [dir, ...s.storageDirHistory.filter((d) => d !== dir)].slice(0, 5)
      })
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
