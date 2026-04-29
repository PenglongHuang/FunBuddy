import { ElectronAPI } from '@electron-toolkit/preload'

export interface FunPetsAPI {
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  storeDelete: (key: string) => Promise<void>
  onStoreDidChange: (callback: (key: string, newValue: unknown, oldValue: unknown) => void) => () => void
  fsReadFile: (filePath: string) => Promise<string>
  fsWriteFile: (filePath: string, content: string) => Promise<void>
  fsDeleteFile: (filePath: string) => Promise<void>
  fsReadDir: (dirPath: string) => Promise<string[]>
  fsExists: (filePath: string) => Promise<boolean>
  fsMkdir: (dirPath: string) => Promise<void>
  fsGetStorageDir: () => Promise<string>
  windowSetSize: (width: number, height: number) => Promise<void>
  windowSetPosition: (x: number, y: number) => Promise<void>
  windowGetDisplay: () => Promise<{ width: number; height: number }>
  windowGetBounds: () => Promise<{ x: number; y: number; width: number; height: number }>
  windowSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>
  notificationShow: (title: string, body: string) => Promise<void>
  dialogOpenDirectory: () => Promise<string | null>
  dialogShowSaveDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
  dialogShowMessageBox: (options: { type?: string; title?: string; message?: string; detail?: string; buttons?: string[]; defaultId?: number; cancelId?: number }) => Promise<{ response: number }>
  fsWriteFileAbsolute: (filePath: string, content: string) => Promise<void>
  autolaunchEnable: () => Promise<void>
  autolaunchDisable: () => Promise<void>
  onQuickCapture: (callback: () => void) => () => void
  windowInvalidate: () => Promise<void>
  startPetTracking: () => Promise<void>
  stopPetTracking: () => Promise<void>
  setPetDragging: (dragging: boolean) => Promise<void>
  onPetCursorHover: (callback: (hovered: boolean) => void) => () => void
}

declare global {
  interface Window {
    api: FunPetsAPI
    electronAPI: ElectronAPI
  }
}
