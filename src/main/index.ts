import { app, BrowserWindow } from 'electron'
import { createMainWindow, setQuitting } from './window'
import { registerIpcHandlers } from './ipc-handlers'
import { getStore } from './store'
import { createTray } from './tray'
import { registerHotkeys, unregisterHotkeys } from './hotkey'

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.funpets.app')
    registerIpcHandlers()
    createMainWindow()
    createTray()
    const hotkey = (getStore().get('settings.app.quickCaptureHotkey') as string) || 'Ctrl+Shift+N'
    registerHotkeys(hotkey)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })

  app.on('before-quit', () => {
    setQuitting(true)
  })

  app.on('will-quit', () => {
    unregisterHotkeys()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
