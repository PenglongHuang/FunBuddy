import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ipc', () => ({
  store: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    setStorageDir: vi.fn().mockResolvedValue(undefined),
  },
  autolaunch: {
    enable: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn().mockResolvedValue(undefined),
  },
}))

import { store } from '@/lib/ipc'
import { useSettingsStore } from '../settingsStore'

const baseState = {
  storageDir: '',
  storageDirHistory: [] as string[],
  pomodoro: { focusDuration: 25, shortBreak: 5, longBreak: 15, roundsBeforeLongBreak: 4 },
  app: { autoStart: false, closeToTray: true, quickCaptureHotkey: 'Ctrl+Shift+N', maxTabsPerPanel: 20, navHistoryLimit: 100, tocMaxLevel: 3 },
  loaded: false,
}

describe('settingsStore.setStorageDir（特权通道）', () => {
  beforeEach(() => {
    useSettingsStore.setState(baseState)
    vi.clearAllMocks()
  })

  it('经 STORE_SET_STORAGE_DIR 通道持久化，不再直写特权键', async () => {
    await useSettingsStore.getState().setStorageDir('D:/ws-a')

    expect(store.setStorageDir).toHaveBeenCalledWith('D:/ws-a')
    // 特权键 settings.storageDir(History) 已被主进程拒绝直写，渲染端不得再尝试
    expect(store.set).not.toHaveBeenCalled()
    expect(useSettingsStore.getState().storageDir).toBe('D:/ws-a')
    expect(useSettingsStore.getState().storageDirHistory).toEqual(['D:/ws-a'])
  })

  it('历史去重置顶并截断到 5 条（与主进程维护逻辑一致）', async () => {
    useSettingsStore.setState({
      storageDir: 'D:/one',
      storageDirHistory: ['D:/one', 'D:/two', 'D:/three', 'D:/four', 'D:/five'],
    })

    await useSettingsStore.getState().setStorageDir('D:/two')

    expect(useSettingsStore.getState().storageDirHistory).toEqual([
      'D:/two', 'D:/one', 'D:/three', 'D:/four', 'D:/five',
    ])
  })

  it('通道被拒（伪造路径）时本地状态不被更新', async () => {
    useSettingsStore.setState({ storageDir: 'D:/ok', storageDirHistory: ['D:/ok'] })
    vi.mocked(store.setStorageDir).mockRejectedValueOnce(new Error('denied'))

    await expect(useSettingsStore.getState().setStorageDir('C:/evil')).rejects.toThrow('denied')
    expect(useSettingsStore.getState().storageDir).toBe('D:/ok')
    expect(useSettingsStore.getState().storageDirHistory).toEqual(['D:/ok'])
  })
})
