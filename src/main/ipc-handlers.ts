import { ipcMain, Notification, dialog, screen, app, BrowserWindow } from 'electron'
import { readFile, writeFile, unlink, readdir, mkdir, rm, cp } from 'fs/promises'
import { existsSync } from 'fs'
import type { Dirent } from 'fs'
import { join, dirname, resolve, relative, parse as parsePath } from 'path'
import { tmpdir } from 'os'
import { getStore } from './store'
import { startTask, stopTask, getProviderInfo } from './claude-service'
import { listAgentSessions, getAgentSessionMessages, deleteAgentSession } from './agents/sessions'
import { resizeWindow, getMainWindow, expandToPanelMode, collapseToPetMode, startPetCursorTracking, stopPetCursorTracking, setPetDragging, movePetDrag, toggleAlwaysOnTop } from './window'
import { IPC } from '../shared/ipc-channels'
import { registerHotkeys } from './hotkey'
import { validatePath } from './path-guard'
import { assertNonPrivilegedStoreKey, assertWritableExtension } from './ipc-guards'
import { IMAGE_EXTENSIONS, collectOrphanImages, extractImageFileNames } from './image-cleanup'
import { nanoid } from 'nanoid'
import sharp from 'sharp'
import { logger } from './logger'

/**
 * 递归收集 notes/ 与 plans/ 下(除被删文档外)全部 .md 的内容;跳过 assets 子树。
 * 任何读取失败都向上抛出以中止整个清理:引用计数不完整时继续删除,
 * 可能误删仍被「读不到的那篇/那棵子树」引用的共享图片。孤儿可留,共享图不可误删。
 */
async function collectSurvivingDocContents(storageDir: string, deletedMdFilePath: string): Promise<string[]> {
  const deletedAbs = resolve(storageDir, deletedMdFilePath)
  const contents: string[] = []
  async function walk(dir: string): Promise<void> {
    // 目录读不出(权限/IO 错误)时抛出中止;不静默跳过任何子树
    const entries: Dirent[] = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'assets') await walk(full)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        if (resolve(full) === deletedAbs) continue
        // 单篇读不到同样中止:该篇的图片引用无从计数,删除可能误删它独占的图
        contents.push(await readFile(full, 'utf-8'))
      }
    }
  }
  await Promise.all(['notes', 'plans'].map(async (category) => {
    const dir = validatePath(storageDir, category)
    // 分类目录整体不存在 = 该类确定无存活文档,视作空集;存在但读失败则由 walk 抛出中止
    if (!existsSync(dir)) return
    await walk(dir)
  }))
  return contents
}

export function registerIpcHandlers(): void {
  const store = getStore()

  function getStorageDir(): string {
    const configured = store.get('settings.storageDir') as string
    if (configured) return configured
    return join(app.getPath('userData'), 'funbuddy-workspace')
  }

  const IMAGE_MAX_SIZE = 10 * 1024 * 1024

  const dataUrlCache = new Map<string, { dataUrl: string; mimeType: string }>()

  function getAssetsDir(mdFilePath: string): { dir: string; assetsDir: string } {
    const dir = getStorageDir()
    const normalized = mdFilePath.replace(/\\/g, '/')
    const category = normalized.startsWith('notes/') ? 'notes' : 'plans'
    return { dir, assetsDir: join(dir, category, 'assets', 'imgs') }
  }

  // Store
  ipcMain.handle(IPC.STORE_GET, (_e, key: string) => store.get(key))
  ipcMain.handle(IPC.STORE_SET, (_e, key: string, value: unknown) => {
    // 渲染端不得直写特权键(含其祖先/后代形态):storageDir 决定全部 FS_* 通道的
    // 文件系统边界,直写等于让受损渲染器把工作区指向任意目录。切换必须走
    // STORE_SET_STORAGE_DIR 令牌通道。详见 src/main/ipc-guards.ts。
    assertNonPrivilegedStoreKey(key)
    return store.set(key, value)
  })
  ipcMain.handle(IPC.STORE_DELETE, (_e, key: string) => store.delete(key))

  // FS (paths relative to storageDir)
  ipcMain.handle(IPC.FS_READ_FILE, async (_e, filePath: string) => {
    return readFile(validatePath(getStorageDir(), filePath), 'utf-8')
  })

  ipcMain.handle(IPC.FS_WRITE_FILE, async (_e, filePath: string, content: string) => {
    const fullPath = validatePath(getStorageDir(), filePath)
    // 纵深防御:限制受损渲染器的写入面——工作区内只允许 Markdown 文档与 JSON 索引,
    // 即便工作区被指到敏感目录也写不进可执行文件。详见 src/main/ipc-guards.ts。
    assertWritableExtension(fullPath)
    await mkdir(dirname(fullPath), { recursive: true })
    return writeFile(fullPath, content, 'utf-8')
  })

  ipcMain.handle(IPC.FS_DELETE_FILE, async (_e, filePath: string) => {
    return unlink(validatePath(getStorageDir(), filePath))
  })

  ipcMain.handle(IPC.FS_READ_DIR, async (_e, dirPath: string) => {
    const fullDir = validatePath(getStorageDir(), dirPath)
    try {
      const entries = await readdir(fullDir, { withFileTypes: true })
      return entries.filter((e) => e.isFile()).map((e) => e.name)
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC.FS_EXISTS, (_e, filePath: string) => {
    return existsSync(validatePath(getStorageDir(), filePath))
  })

  ipcMain.handle(IPC.FS_MKDIR, async (_e, dirPath: string) => {
    return mkdir(validatePath(getStorageDir(), dirPath), { recursive: true })
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

  // 记录「目录选择对话框」选定过的工作区路径，作为 STORE_SET_STORAGE_DIR 的会话令牌
  const pickedDirTokens = new Set<string>()

  ipcMain.handle(IPC.DIALOG_OPEN_DIRECTORY, async () => {
    const result = await withForegroundDialog(() => dialog.showOpenDialog({ properties: ['openDirectory'] }))
    const dir = result.canceled ? null : result.filePaths[0]
    if (dir) pickedDirTokens.add(dir)
    return dir
  })

  // 工作区切换(特权):复用 saveDialogPaths 的令牌模式——只接受「本会话经
  // DIALOG_OPEN_DIRECTORY 返回、未消费」的路径，或主进程持久化历史
  // (settings.storageDirHistory，渲染端不可直写)中已有的路径；令牌一次性消费。
  ipcMain.handle(IPC.STORE_SET_STORAGE_DIR, (_e, dir: string) => {
    if (typeof dir !== 'string' || !dir) {
      throw new Error('Invalid storage dir')
    }
    const history = (store.get('settings.storageDirHistory') as string[] | undefined) ?? []
    if (pickedDirTokens.has(dir)) {
      pickedDirTokens.delete(dir)
    } else if (!history.includes(dir)) {
      throw new Error('工作区路径必须是本次会话中通过目录选择对话框选定，或位于最近使用列表中')
    }
    store.set('settings.storageDir', dir)
    store.set('settings.storageDirHistory', [dir, ...history.filter((d) => d !== dir)].slice(0, 5))
  })

  // 保存对话框选定过的路径，作为 FS_WRITE_FILE_ABSOLUTE 的一次性令牌
  const saveDialogPaths = new Set<string>()

  ipcMain.handle(IPC.DIALOG_SHOW_SAVE_DIALOG, async (_e, options: Electron.SaveDialogOptions) => {
    const result = await withForegroundDialog(() => dialog.showSaveDialog(options))
    const filePath = result.canceled ? null : result.filePath
    if (filePath) saveDialogPaths.add(filePath)
    return filePath
  })

  ipcMain.handle(IPC.DIALOG_SHOW_MESSAGE_BOX, async (_e, options: Electron.MessageBoxOptions) => {
    return withForegroundDialog(() => dialog.showMessageBox(options))
  })

  // FS absolute path write (for exports) — 仅限本次会话中用户经保存对话框明确选定的路径，且令牌一次性
  ipcMain.handle(IPC.FS_WRITE_FILE_ABSOLUTE, async (_e, filePath: string, content: string) => {
    if (!saveDialogPaths.has(filePath)) {
      throw new Error('绝对路径写入仅限本次会话中通过保存对话框选择的路径')
    }
    saveDialogPaths.delete(filePath)
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
    else logger.warn('PET_START_TRACKING: no main window')
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

  ipcMain.handle(IPC.IMAGE_CLEANUP, async (_e, mdFilePath: string) => {
    // 文档删除前由渲染端调用:删除「仅被该文档引用」的孤儿图片,避免持续累积。
    // 副本(duplicateNote 复制内容但不复制图片文件)与其他文档可能共享同一图片,
    // 必须确认其余存活文档均不再引用才可删除。清理失败不阻止文档删除。
    const storageDir = getStorageDir()
    let content: string
    try {
      content = await readFile(validatePath(storageDir, mdFilePath), 'utf-8')
    } catch {
      return
    }
    // 被删文档无图片引用 → 无孤儿可言,跳过全库扫描(批量删除时避免 O(N²))
    if (extractImageFileNames(content).size === 0) return
    let otherContents: string[]
    try {
      otherContents = await collectSurvivingDocContents(storageDir, mdFilePath)
    } catch {
      // 存活文档扫描不完整时宁可不删:孤儿可留,共享图不可误删
      return
    }
    const { assetsDir } = getAssetsDir(mdFilePath)
    for (const fileName of collectOrphanImages(content, otherContents)) {
      try {
        await unlink(validatePath(assetsDir, fileName))
      } catch { /* 图片已不存在时忽略 */ }
    }
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

    // fullPath 是拼好的绝对路径:先取相对路径再走 validatePath 做包含校验,
    // 避免裸 startsWith 被兄弟前缀目录(如 /ws-extended)绕过。
    try {
      validatePath(storageDir, relative(storageDir, fullPath))
    } catch {
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

  // AI
  ipcMain.handle(IPC.AI_START_TASK, (_e, taskId: string, prompt: string, workspace: string, sessionId?: string) => {
    return startTask(taskId, prompt, workspace, sessionId)
  })
  ipcMain.handle(IPC.AI_STOP_TASK, (_e, taskId: string) => {
    stopTask(taskId)
  })
  ipcMain.handle(IPC.AI_GET_PROVIDER_INFO, () => getProviderInfo())
  ipcMain.handle(IPC.AI_LIST_SESSIONS, (_e, dir: string, limit?: number) =>
    listAgentSessions({ dir, limit }),
  )
  ipcMain.handle(IPC.AI_GET_SESSION_MESSAGES, (_e, sessionId: string, dir: string) =>
    getAgentSessionMessages(sessionId, { dir }),
  )
  ipcMain.handle(IPC.AI_DELETE_SESSION, (_e, sessionId: string, dir: string) =>
    deleteAgentSession(sessionId, dir),
  )
}
