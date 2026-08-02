import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ipc', () => ({
  store: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
  },
  autolaunch: {
    enable: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn().mockResolvedValue(undefined),
  },
}))

import { store } from '@/lib/ipc'
import { useSettingsStore } from '../settingsStore'

const defaultState = {
  storageDir: '',
  storageDirHistory: [],
  pomodoro: { focusDuration: 25, shortBreak: 5, longBreak: 15, roundsBeforeLongBreak: 4 },
  app: { autoStart: false, closeToTray: true, quickCaptureHotkey: 'Ctrl+Shift+N', maxTabsPerPanel: 20, navHistoryLimit: 100, tocMaxLevel: 3 },
  loaded: false,
}

describe('settingsStore.load', () => {
  beforeEach(() => {
    useSettingsStore.setState(defaultState)
    vi.clearAllMocks()
  })

  it('migrates a legacy TOC depth when the new setting is absent', async () => {
    vi.mocked(store.get)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ tocMaxLevel: 5 })

    await useSettingsStore.getState().load()

    expect(useSettingsStore.getState().app).toMatchObject({ tocMaxLevel: 5 })
    expect(useSettingsStore.getState().loaded).toBe(true)
    expect(store.set).toHaveBeenCalledWith('settings.app', expect.objectContaining({ tocMaxLevel: 5 }))
  })

  it('keeps an existing new TOC depth over a different legacy value', async () => {
    vi.mocked(store.get)
      .mockResolvedValueOnce({ app: { tocMaxLevel: 4 } })
      .mockResolvedValueOnce({ tocMaxLevel: 5 })

    await useSettingsStore.getState().load()

    expect(useSettingsStore.getState().app).toMatchObject({ tocMaxLevel: 4 })
    expect(store.set).not.toHaveBeenCalled()
  })
})
