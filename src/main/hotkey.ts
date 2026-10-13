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

/** 立即销毁快捷捕捉窗(若处于隐藏存活态)。
 *  主窗真关闭时必须调用:捕捉窗存活会让 window-all-closed 永不触发(应用进程挂着),
 *  且托盘的「操作面板」/点击用 BrowserWindow.getAllWindows()[0] 找主窗,会解析到这个
 *  300×160 的捕捉窗——显示错窗,主窗直至重启无法恢复。
 */
export function destroyQuickCapture(): void {
  quickCaptureWin?.destroy()
  quickCaptureWin = null
}

function showQuickCapture(): void {
  // isDestroyed 守卫与 window.ts 的防御风格一致：'closed' 正常会清空引用，
  // 这里防的是未来重构引入的销毁态残留（销毁态上调 show/send 会抛错）
  if (quickCaptureWin && !quickCaptureWin.isDestroyed()) {
    quickCaptureWin.show()
    quickCaptureWin.focus()
    // blur 只隐藏不销毁；复显时必须重发事件，否则渲染端不再收到通知，
    // 旧文本残留、输入框失焦（dom-ready 上的发送只在首次创建时触发一次）
    quickCaptureWin.webContents.send(IPC.HOTKEY_QUICK_CAPTURE)
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
