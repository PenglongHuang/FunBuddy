import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'

const api = {
  // Store
  storeGet: (key: string) => ipcRenderer.invoke(IPC.STORE_GET, key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke(IPC.STORE_SET, key, value),
  storeDelete: (key: string) => ipcRenderer.invoke(IPC.STORE_DELETE, key),
  onStoreDidChange: (callback: (key: string, newValue: unknown, oldValue: unknown) => void) => {
    const handler = (_e: any, data: { key: string; newValue: unknown; oldValue: unknown }) => callback(data.key, data.newValue, data.oldValue)
    ipcRenderer.on(IPC.STORE_ON_DID_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC.STORE_ON_DID_CHANGE, handler)
  },

  // FS
  fsReadFile: (filePath: string) => ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),
  fsWriteFile: (filePath: string, content: string) => ipcRenderer.invoke(IPC.FS_WRITE_FILE, filePath, content),
  fsDeleteFile: (filePath: string) => ipcRenderer.invoke(IPC.FS_DELETE_FILE, filePath),
  fsReadDir: (dirPath: string) => ipcRenderer.invoke(IPC.FS_READ_DIR, dirPath) as Promise<string[]>,
  fsExists: (filePath: string) => ipcRenderer.invoke(IPC.FS_EXISTS, filePath) as Promise<boolean>,
  fsMkdir: (dirPath: string) => ipcRenderer.invoke(IPC.FS_MKDIR, dirPath),
  fsGetStorageDir: () => ipcRenderer.invoke(IPC.FS_GET_STORAGE_DIR) as Promise<string>,

  // Window
  windowSetSize: (width: number, height: number) => ipcRenderer.invoke(IPC.WINDOW_SET_SIZE, width, height),
  windowSetPosition: (x: number, y: number) => ipcRenderer.invoke(IPC.WINDOW_SET_POSITION, x, y),
  windowGetDisplay: () => ipcRenderer.invoke(IPC.WINDOW_GET_DISPLAY) as Promise<{ width: number; height: number }>,
  windowGetBounds: () => ipcRenderer.invoke(IPC.WINDOW_GET_BOUNDS),
  windowSetBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke(IPC.WINDOW_SET_BOUNDS, bounds),
  windowSetIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.invoke(IPC.WINDOW_SET_IGNORE_MOUSE_EVENTS, ignore),
  windowExpandPanel: (petX?: number, petY?: number) =>
    ipcRenderer.invoke(IPC.WINDOW_EXPAND_PANEL, petX, petY),
  windowCollapsePet: (petX?: number, petY?: number) =>
    ipcRenderer.invoke(IPC.WINDOW_COLLAPSE_PET, petX, petY),
  windowHide: () => ipcRenderer.invoke(IPC.WINDOW_HIDE),
  windowMaximize: () => ipcRenderer.invoke(IPC.WINDOW_MAXIMIZE),
  windowRestoreDefault: () => ipcRenderer.invoke(IPC.WINDOW_RESTORE_DEFAULT),
  windowInvalidate: () =>
    ipcRenderer.invoke(IPC.WINDOW_INVALIDATE),
  windowMinimize: () =>
    ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
  windowToggleAlwaysOnTop: () =>
    ipcRenderer.invoke(IPC.WINDOW_TOGGLE_ALWAYS_ON_TOP) as Promise<boolean>,

  // Notification
  notificationShow: (title: string, body: string) => ipcRenderer.invoke(IPC.NOTIFICATION_SHOW, title, body),

  // Dialog
  dialogOpenDirectory: () => ipcRenderer.invoke(IPC.DIALOG_OPEN_DIRECTORY) as Promise<string | null>,
  dialogShowSaveDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke(IPC.DIALOG_SHOW_SAVE_DIALOG, options) as Promise<string | null>,
  dialogShowMessageBox: (options: { type?: string; title?: string; message?: string; detail?: string; buttons?: string[]; defaultId?: number; cancelId?: number }) =>
    ipcRenderer.invoke(IPC.DIALOG_SHOW_MESSAGE_BOX, options) as Promise<{ response: number }>,

  // FS absolute
  fsWriteFileAbsolute: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC.FS_WRITE_FILE_ABSOLUTE, filePath, content) as Promise<void>,

  // Image
  imageSave: (mdFilePath: string, imageData: ArrayBuffer, ext: string, altName?: string) =>
    ipcRenderer.invoke(IPC.IMAGE_SAVE, mdFilePath, imageData, ext, altName) as Promise<{ relativePath: string; fileName: string }>,
  imagePickAndSave: (mdFilePath: string) =>
    ipcRenderer.invoke(IPC.IMAGE_PICK_AND_SAVE, mdFilePath) as Promise<{ relativePath: string; fileName: string } | null>,
  imageDelete: (mdFilePath: string, imageFileName: string) =>
    ipcRenderer.invoke(IPC.IMAGE_DELETE, mdFilePath, imageFileName) as Promise<void>,
  imageCleanup: (mdFilePath: string) =>
    ipcRenderer.invoke(IPC.IMAGE_CLEANUP, mdFilePath) as Promise<void>,
  imageReadAsDataUrl: (mdFilePath: string, imageFileName: string, maxWidth?: number) =>
    ipcRenderer.invoke(IPC.IMAGE_READ_AS_DATA_URL, mdFilePath, imageFileName, maxWidth) as Promise<{ dataUrl: string; mimeType: string }>,
  imageMoveAssets: (oldMdFilePath: string, newMdFilePath: string) =>
    ipcRenderer.invoke(IPC.IMAGE_MOVE_ASSETS, oldMdFilePath, newMdFilePath) as Promise<void>,

  // PDF
  exportPdf: (html: string, fileName: string, defaultPath?: string) =>
    ipcRenderer.invoke(IPC.EXPORT_PDF, html, fileName, defaultPath) as Promise<
      { success: true; filePath: string } | { success: true } | { success: false; error: string }
    >,

  // Auto-launch
  autolaunchEnable: () => ipcRenderer.invoke(IPC.AUTOLAUNCH_ENABLE),
  autolaunchDisable: () => ipcRenderer.invoke(IPC.AUTOLAUNCH_DISABLE),

  // Hotkey events
  onQuickCapture: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.HOTKEY_QUICK_CAPTURE, handler)
    return () => ipcRenderer.removeListener(IPC.HOTKEY_QUICK_CAPTURE, handler)
  },
  hotkeyRegister: (accelerator: string) =>
    ipcRenderer.invoke(IPC.HOTKEY_REGISTER, accelerator),

  // Pet cursor tracking
  startPetTracking: () => ipcRenderer.invoke(IPC.PET_START_TRACKING),
  stopPetTracking: () => ipcRenderer.invoke(IPC.PET_STOP_TRACKING),
  setPetDragging: (dragging: boolean, cursorX?: number, cursorY?: number) =>
    ipcRenderer.invoke(IPC.PET_SET_DRAGGING, dragging, cursorX, cursorY),
  windowMoveBy: (cursorX: number, cursorY: number) =>
    ipcRenderer.send(IPC.WINDOW_MOVE_BY, cursorX, cursorY),
  onPetCursorHover: (callback: (hovered: boolean) => void) => {
    const handler = (_e: any, data: { hovered: boolean }) => callback(data.hovered)
    ipcRenderer.on(IPC.PET_CURSOR_HOVER, handler)
    return () => ipcRenderer.removeListener(IPC.PET_CURSOR_HOVER, handler)
  },

  // Quick note navigation
  quickNoteSaved: (noteId: string) => {
    ipcRenderer.send(IPC.QUICK_NOTE_SAVED, noteId)
  },
  onNavigateToNote: (callback: (noteId: string) => void) => {
    const handler = (_e: any, noteId: string) => callback(noteId)
    ipcRenderer.on(IPC.NAVIGATE_TO_NOTE, handler)
    return () => ipcRenderer.removeListener(IPC.NAVIGATE_TO_NOTE, handler)
  },

  // Window mode (main → renderer)
  onSetWindowMode: (callback: (mode: string) => void) => {
    const handler = (_e: any, mode: string) => callback(mode)
    ipcRenderer.on(IPC.SET_WINDOW_MODE, handler)
    return () => ipcRenderer.removeListener(IPC.SET_WINDOW_MODE, handler)
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  ;(window as any).api = api
}
