import { BrowserWindow, globalShortcut } from 'electron'
import { join } from 'path'
import { IPC } from '../shared/ipc-channels'

let quickCaptureWin: BrowserWindow | null = null
let currentAccelerator: string | null = null

export function registerHotkeys(accelerator: string): boolean {
  if (currentAccelerator) {
    globalShortcut.unregister(currentAccelerator)
  }
  const success = globalShortcut.register(accelerator, () => {
    showQuickCapture()
  })
  if (success) {
    currentAccelerator = accelerator
  } else if (currentAccelerator) {
    globalShortcut.register(currentAccelerator, () => showQuickCapture())
  }
  return success
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}

function showQuickCapture(): void {
  if (quickCaptureWin) {
    quickCaptureWin.show()
    quickCaptureWin.focus()
    return
  }

  quickCaptureWin = new BrowserWindow({
    width: 300,
    height: 160,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  quickCaptureWin.center()

  quickCaptureWin.webContents.on('dom-ready', () => {
    quickCaptureWin!.webContents.send(IPC.HOTKEY_QUICK_CAPTURE)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    quickCaptureWin.loadURL(process.env.ELECTRON_RENDERER_URL + '#quick-capture')
  } else {
    quickCaptureWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'quick-capture' })
  }

  quickCaptureWin.on('blur', () => {
    quickCaptureWin?.hide()
  })

  quickCaptureWin.on('closed', () => {
    quickCaptureWin = null
  })
}
