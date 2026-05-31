import { ipcMain, Notification, dialog, screen, app, BrowserWindow } from 'electron'
import { readFile, writeFile, unlink, readdir, mkdir, rm, cp } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, resolve, parse as parsePath } from 'path'
import { tmpdir } from 'os'
import { getStore } from './store'
import { resizeWindow, getMainWindow, expandToPanelMode, collapseToPetMode, startPetCursorTracking, stopPetCursorTracking, setPetDragging, movePetDrag, toggleAlwaysOnTop } from './window'
import { IPC } from '../shared/ipc-channels'
import { registerHotkeys } from './hotkey'
import { nanoid } from 'nanoid'
import sharp from 'sharp'

export function registerIpcHandlers(): void {
  const store = getStore()

  function getStorageDir(): string {
    const configured = store.get('settings.storageDir') as string
    if (configured) return configured
    return join(app.getPath('userData'), 'funbuddy-workspace')
  }

  const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
  const IMAGE_MAX_SIZE = 10 * 1024 * 1024

  const dataUrlCache = new Map<string, { dataUrl: string; mimeType: string }>()

  function validatePath(dir: string, filePath: string): string {
    const fullPath = resolve(dir, filePath)
    if (!fullPath.startsWith(resolve(dir))) {
      throw new Error('Invalid path')
    }
    return fullPath
  }

  function getAssetsDir(mdFilePath: string): { dir: string; assetsDir: string } {
    const dir = getStorageDir()
    const normalized = mdFilePath.replace(/\\/g, '/')
    const category = normalized.startsWith('notes/') ? 'notes' : 'plans'
    return { dir, assetsDir: join(dir, category, 'assets', 'imgs') }
  }

  // Store
  ipcMain.handle(IPC.STORE_GET, (_e, key: string) => store.get(key))
  ipcMain.handle(IPC.STORE_SET, (_e, key: string, value: unknown) => store.set(key, value))
  ipcMain.handle(IPC.STORE_DELETE, (_e, key: string) => store.delete(key))

  // Store change listener
  ipcMain.handle(IPC.STORE_ON_DID_CHANGE, (e) => {
    const unsubscribe = store.onDidChange('settings' as any, (newValue, oldValue) => {
      try {
        e.sender.send(IPC.STORE_ON_DID_CHANGE, { key: 'settings', newValue, oldValue })
      } catch { /* window may be closed */ }
    })
    return unsubscribe
  })

  // FS (paths relative to storageDir)
  ipcMain.handle(IPC.FS_READ_FILE, async (_e, filePath: string) => {
    const dir = getStorageDir()
    return readFile(join(dir, filePath), 'utf-8')
  })

  ipcMain.handle(IPC.FS_WRITE_FILE, async (_e, filePath: string, content: string) => {
    const dir = getStorageDir()
    const fullPath = join(dir, filePath)
    await mkdir(dirname(fullPath), { recursive: true })
    return writeFile(fullPath, content, 'utf-8')
  })

  ipcMain.handle(IPC.FS_DELETE_FILE, async (_e, filePath: string) => {
    const dir = getStorageDir()
    return unlink(join(dir, filePath))
  })

  ipcMain.handle(IPC.FS_READ_DIR, async (_e, dirPath: string) => {
    const base = getStorageDir()
    const fullDir = join(base, dirPath)
    try {
      const entries = await readdir(fullDir, { withFileTypes: true })
      return entries.filter((e) => e.isFile()).map((e) => e.name)
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC.FS_EXISTS, (_e, filePath: string) => {
    const dir = getStorageDir()
    return existsSync(join(dir, filePath))
  })

  ipcMain.handle(IPC.FS_MKDIR, async (_e, dirPath: string) => {
    const base = getStorageDir()
    return mkdir(join(base, dirPath), { recursive: true })
  })

  ipcMain.handle(IPC.FS_GET_STORAGE_DIR, () => {
    return getStorageDir()
  })

  // Window
  ipcMain.handle(IPC.WINDOW_SET_SIZE, (_e, width: number, height: number) => {
    resizeWindow(width, height)
  })

  ipcMain.handle(IPC.WINDOW_SET_POSITION, (_e, x: number, y: number) => {
    getMainWindow()?.setPosition(x, y)
  })

  ipcMain.handle(IPC.WINDOW_GET_DISPLAY, () => {
    const win = getMainWindow()
    const display = win
      ? screen.getDisplayNearestPoint({ x: win.getBounds().x, y: win.getBounds().y })
      : screen.getPrimaryDisplay()
    return {
      width: display.workAreaSize.width,
      height: display.workAreaSize.height,
      bounds: { x: display.bounds.x, y: display.bounds.y },
    }
  })

  ipcMain.handle(IPC.WINDOW_GET_BOUNDS, (_e) => {
    return getMainWindow()?.getBounds()
  })

  ipcMain.handle(IPC.WINDOW_SET_BOUNDS, (_e, bounds: { x: number; y: number; width: number; height: number }) => {
    getMainWindow()?.setBounds(bounds)
  })

  ipcMain.handle(IPC.WINDOW_SET_IGNORE_MOUSE_EVENTS, (_e, ignore: boolean) => {
    getMainWindow()?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.on(IPC.WINDOW_MOVE_BY, (_e, cursorX: number, cursorY: number) => {
    movePetDrag(cursorX, cursorY)
  })

  ipcMain.handle(IPC.WINDOW_EXPAND_PANEL, (_e, petX?: number, petY?: number) => {
    const savedSize = store.get('window.expandedSize') as { width: number; height: number } | undefined
    return expandToPanelMode(petX, petY, savedSize)
  })

  ipcMain.handle(IPC.WINDOW_COLLAPSE_PET, (_e, petX?: number, petY?: number) => {
    const savedSize = collapseToPetMode(petX, petY)
    if (savedSize) {
      store.set('window.expandedSize', savedSize)
    }
  })

  ipcMain.handle(IPC.WINDOW_HIDE, () => {
    getMainWindow()?.hide()
  })

  let isMaximizedState = false
  let preMaximizeBounds: { x: number; y: number; width: number; height: number } | null = null
  ipcMain.handle(IPC.WINDOW_MAXIMIZE, () => {
    const win = getMainWindow()
    if (!win) return
    if (isMaximizedState) {
      if (preMaximizeBounds) {
        win.setBounds(preMaximizeBounds)
        preMaximizeBounds = null
      }
      isMaximizedState = false
    } else {
      preMaximizeBounds = win.getBounds()
      const display = screen.getDisplayNearestPoint({
        x: preMaximizeBounds.x + preMaximizeBounds.width / 2,
        y: preMaximizeBounds.y + preMaximizeBounds.height / 2,
      })
      win.setBounds({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.workAreaSize.width,
        height: display.workAreaSize.height,
      })
      isMaximizedState = true
    }
  })

  ipcMain.handle(IPC.WINDOW_RESTORE_DEFAULT, () => {
    const win = getMainWindow()
    if (!win) return
    isMaximizedState = false
    preMaximizeBounds = null
    const display = screen.getDisplayNearestPoint({
      x: win.getBounds().x + win.getBounds().width / 2,
      y: win.getBounds().y + win.getBounds().height / 2,
    })
    const width = 480
    const height = 680
    const { workAreaSize } = display
    win.setBounds({
      x: display.bounds.x + workAreaSize.width - width,
      y: display.bounds.y + Math.floor((workAreaSize.height - height) / 2),
      width,
      height,
    })
  })

  ipcMain.handle(IPC.WINDOW_INVALIDATE, () => {
    const win = getMainWindow()
    if (win) {
      win.webContents.invalidate()
    }
  })

  ipcMain.handle(IPC.WINDOW_MINIMIZE, () => {
    getMainWindow()?.minimize()
  })

  ipcMain.handle(IPC.WINDOW_TOGGLE_ALWAYS_ON_TOP, () => {
    return toggleAlwaysOnTop()
  })

  // Notification
  ipcMain.handle(IPC.NOTIFICATION_SHOW, (_e, title: string, body: string) => {
    new Notification({ title, body }).show()
  })

  // Dialog — temporarily lower alwaysOnTop so native dialogs appear in front
  const withForegroundDialog = async <T>(fn: () => Promise<T>): Promise<T> => {
    const win = getMainWindow()
    let wasOnTop = false
    if (win) {
      wasOnTop = win.isAlwaysOnTop()
      win.setAlwaysOnTop(false)
    }
    try {
      return await fn()
    } finally {
      if (win) win.setAlwaysOnTop(wasOnTop, 'floating')
    }
  }

  ipcMain.handle(IPC.DIALOG_OPEN_DIRECTORY, async () => {
    const result = await withForegroundDialog(() => dialog.showOpenDialog({ properties: ['openDirectory'] }))
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.DIALOG_SHOW_SAVE_DIALOG, async (_e, options: Electron.SaveDialogOptions) => {
    const result = await withForegroundDialog(() => dialog.showSaveDialog(options))
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle(IPC.DIALOG_SHOW_MESSAGE_BOX, async (_e, options: Electron.MessageBoxOptions) => {
    return withForegroundDialog(() => dialog.showMessageBox(options))
  })

  // FS absolute path write (for exports)
  ipcMain.handle(IPC.FS_WRITE_FILE_ABSOLUTE, async (_e, filePath: string, content: string) => {
    await mkdir(dirname(filePath), { recursive: true })
    return writeFile(filePath, content, 'utf-8')
  })

  // PDF export
  ipcMain.handle(
    IPC.EXPORT_PDF,
    async (_e, html: string, fileName: string, defaultPath?: string) => {
      let win: BrowserWindow | null = null
      let tmpFile = ''
      try {
        win = new BrowserWindow({ width: 800, height: 1200, show: false, webPreferences: { offscreen: true } })
        tmpFile = join(tmpdir(), `funbuddy-export-${nanoid(8)}.html`)
        await writeFile(tmpFile, html, 'utf-8')
        await win.loadURL(`file://${tmpFile}`)
        await new Promise(resolve => setTimeout(resolve, 500))

        const pdfBytes = await win.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
        })

        const saveResult = await withForegroundDialog(() =>
          dialog.showSaveDialog({
            defaultPath: defaultPath || fileName,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
          }),
        )

        if (saveResult.canceled || !saveResult.filePath) {
          return { success: true as const }
        }

        await writeFile(saveResult.filePath, Buffer.from(pdfBytes))
        return { success: true as const, filePath: saveResult.filePath }
      } catch (err: any) {
        return { success: false as const, error: err.message || String(err) }
      } finally {
        win?.destroy()
        if (tmpFile) { unlink(tmpFile).catch(() => {}) }
      }
    },
  )

  // Auto-launch
  ipcMain.handle(IPC.AUTOLAUNCH_ENABLE, () => {
    app.setLoginItemSettings({ openAtLogin: true })
  })
  ipcMain.handle(IPC.AUTOLAUNCH_DISABLE, () => {
    app.setLoginItemSettings({ openAtLogin: false })
  })

  // Hotkey re-registration
  ipcMain.handle(IPC.HOTKEY_REGISTER, (_e, accelerator: string) => {
    if (!accelerator || typeof accelerator !== 'string') {
      return { success: false, error: '无效的快捷键' }
    }
    const success = registerHotkeys(accelerator)
    if (!success) {
      return { success: false, error: '快捷键已被其他应用占用' }
    }
    store.set('settings.app.quickCaptureHotkey', accelerator)
    return { success: true }
  })

  // Pet cursor tracking
  ipcMain.handle(IPC.PET_START_TRACKING, () => {
    const win = getMainWindow()
    if (win) startPetCursorTracking(win)
  })

  ipcMain.handle(IPC.PET_STOP_TRACKING, () => {
    stopPetCursorTracking()
  })

  ipcMain.handle(IPC.PET_SET_DRAGGING, (_e, dragging: boolean, cursorX?: number, cursorY?: number) => {
    setPetDragging(dragging, cursorX, cursorY)
  })

  // Quick note saved → relay to main window
  ipcMain.on(IPC.QUICK_NOTE_SAVED, (_e, noteId: string) => {
    const mainWin = getMainWindow()
    if (!mainWin || mainWin.isDestroyed()) return
    const send = () => mainWin.webContents.send(IPC.NAVIGATE_TO_NOTE, noteId)
    if (mainWin.webContents.isLoading()) {
      mainWin.webContents.once('dom-ready', send)
    } else {
      send()
    }
  })

  // === Image handlers ===

  ipcMain.handle(IPC.IMAGE_SAVE, async (_e, mdFilePath: string, imageData: ArrayBuffer, ext: string, _altName?: string) => {
    if (!IMAGE_EXTENSIONS.includes(ext.toLowerCase())) {
      throw new Error(`Unsupported image format: ${ext}`)
    }

    const { assetsDir } = getAssetsDir(mdFilePath)
    await mkdir(assetsDir, { recursive: true })

    const buffer = Buffer.from(imageData)
    if (buffer.length > IMAGE_MAX_SIZE) {
      throw new Error('Image exceeds 10MB limit')
    }

    let format: string
    try {
      const meta = await sharp(buffer).metadata()
      if (!meta.format) throw new Error('No format')
      format = meta.format
    } catch {
      throw new Error('Invalid image data')
    }

    const actualExt = format === 'jpeg' ? 'jpg' : format
    const ts = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
    const fileName = `${ts}-${nanoid(4)}.${actualExt}`
    await writeFile(join(assetsDir, fileName), buffer)

    const relativePath = `./assets/imgs/${fileName}`
    return { relativePath, fileName }
  })

  ipcMain.handle(IPC.IMAGE_PICK_AND_SAVE, async (_e, mdFilePath: string) => {
    const result = await withForegroundDialog(() =>
      dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
      })
    )
    if (result.canceled || result.filePaths.length === 0) return null

    const { assetsDir } = getAssetsDir(mdFilePath)
    await mkdir(assetsDir, { recursive: true })

    const saved = await Promise.all(result.filePaths.map(async (srcPath) => {
      const ext = srcPath.split('.').pop()?.toLowerCase() || 'png'
      const ts = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
      const fileName = `${ts}-${nanoid(4)}.${ext}`
      await cp(srcPath, join(assetsDir, fileName))
      return { relativePath: `./assets/imgs/${fileName}`, fileName }
    }))

    return saved[0]
  })

  ipcMain.handle(IPC.IMAGE_DELETE, async () => {
    // No-op: never delete images
  })

  ipcMain.handle(IPC.IMAGE_CLEANUP, async () => {
    // No-op: never delete images
  })

  ipcMain.handle(IPC.IMAGE_READ_AS_DATA_URL, async (_e, mdFilePath: string, imagePath: string, maxWidth?: number) => {
    const fileName = imagePath.replace(/\\/g, '/').split('/').pop() || imagePath
    const cacheKey = `${fileName}:${maxWidth || 0}`
    const cached = dataUrlCache.get(cacheKey)
    if (cached) return cached

    const storageDir = getStorageDir()
    const { assetsDir } = getAssetsDir(mdFilePath)
    let fullPath = join(assetsDir, fileName)

    // Fallback to other category
    if (!existsSync(fullPath)) {
      const normalized = mdFilePath.replace(/\\/g, '/')
      const otherCategory = normalized.startsWith('notes/') ? 'plans' : 'notes'
      const fallbackDir = join(storageDir, otherCategory, 'assets', 'imgs')
      const fallbackPath = join(fallbackDir, fileName)
      if (existsSync(fallbackPath)) fullPath = fallbackPath
    }

    if (!resolve(fullPath).startsWith(resolve(storageDir))) {
      throw new Error('Invalid image path')
    }

    if (!existsSync(fullPath)) {
      throw new Error(`Image not found: ${fileName}`)
    }

    let buffer: Buffer
    let mimeType: string

    if (maxWidth && maxWidth > 0) {
      const image = sharp(fullPath)
      const meta = await image.metadata()
      if (meta.width && meta.width > maxWidth) {
        buffer = await image.resize(maxWidth).toBuffer()
      } else {
        buffer = await readFile(fullPath) as Buffer
      }
      const format = meta.format || 'png'
      mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`
    } else {
      buffer = await readFile(fullPath) as Buffer
      const meta = await sharp(buffer).metadata()
      const format = meta.format || 'png'
      mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`
    }

    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
    const result = { dataUrl, mimeType }
    dataUrlCache.set(cacheKey, result)
    return result
  })

  ipcMain.handle(IPC.IMAGE_MOVE_ASSETS, async () => {
    // No-op: images are centralized, no per-document dirs to move
  })
}
