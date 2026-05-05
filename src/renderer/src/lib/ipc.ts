export const store = {
  get: <T = unknown>(key: string): Promise<T> =>
    window.api.storeGet(key) as Promise<T>,
  set: (key: string, value: unknown): Promise<void> =>
    window.api.storeSet(key, value),
  delete: (key: string): Promise<void> =>
    window.api.storeDelete(key),
}

export const fs = {
  readFile: (filePath: string): Promise<string> =>
    window.api.fsReadFile(filePath),
  writeFile: (filePath: string, content: string): Promise<void> =>
    window.api.fsWriteFile(filePath, content),
  deleteFile: (filePath: string): Promise<void> =>
    window.api.fsDeleteFile(filePath),
  readDir: (dirPath: string): Promise<string[]> =>
    window.api.fsReadDir(dirPath),
  exists: (filePath: string): Promise<boolean> =>
    window.api.fsExists(filePath),
  mkdir: (dirPath: string): Promise<void> =>
    window.api.fsMkdir(dirPath),
  getStorageDir: (): Promise<string> =>
    window.api.fsGetStorageDir(),
  writeFileAbsolute: (filePath: string, content: string): Promise<void> =>
    window.api.fsWriteFileAbsolute(filePath, content),
}

export const windowApi = {
  setSize: (width: number, height: number): Promise<void> =>
    window.api.windowSetSize(width, height),
  setPosition: (x: number, y: number): Promise<void> =>
    window.api.windowSetPosition(x, y),
  getDisplay: () =>
    window.api.windowGetDisplay(),
  getWindowBounds: () => window.api.windowGetBounds(),
  setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    window.api.windowSetBounds(bounds),
  setIgnoreMouseEvents: (ignore: boolean) =>
    window.api.windowSetIgnoreMouseEvents(ignore),
  moveBy: (cursorX: number, cursorY: number) =>
    window.api.windowMoveBy(cursorX, cursorY),
  expandPanel: (petX?: number, petY?: number): Promise<{ x: number; y: number }> =>
    window.api.windowExpandPanel(petX, petY) as Promise<{ x: number; y: number }>,
  collapsePet: (petX?: number, petY?: number) =>
    window.api.windowCollapsePet(petX, petY),
  hide: (): Promise<void> =>
    window.api.windowHide(),
  maximize: (): Promise<void> =>
    window.api.windowMaximize(),
  restoreDefault: (): Promise<void> =>
    window.api.windowRestoreDefault(),
  resizeForSidePanel: async (panelWidth: number) => {
    const bounds = await windowApi.getWindowBounds()
    if (!bounds) return
    // Expand leftward: decrease x, increase width
    const newBounds = {
      x: bounds.x - panelWidth,
      y: bounds.y,
      width: bounds.width + panelWidth,
      height: bounds.height,
    }
    // Clamp to screen: don't go past left edge
    if (newBounds.x < 0) {
      newBounds.x = 0
    }
    await windowApi.setBounds(newBounds)
  },
  titlebarDrag: (deltaX: number, deltaY: number): void =>
    window.api.windowTitlebarDrag(deltaX, deltaY),
  invalidate: (): Promise<void> =>
    window.api.windowInvalidate(),
  minimize: (): Promise<void> =>
    window.api.windowMinimize(),
  startPetTracking: (): Promise<void> =>
    window.api.startPetTracking(),
  stopPetTracking: (): Promise<void> =>
    window.api.stopPetTracking(),
  setPetDragging: (dragging: boolean, cursorX?: number, cursorY?: number): Promise<void> =>
    window.api.setPetDragging(dragging, cursorX, cursorY),
}

export const notify = {
  show: (title: string, body: string): Promise<void> =>
    window.api.notificationShow(title, body),
}

export const dialog = {
  openDirectory: (): Promise<string | null> =>
    window.api.dialogOpenDirectory(),
  showSaveDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null> =>
    window.api.dialogShowSaveDialog(options),
  showMessageBox: (options: { type?: string; title?: string; message?: string; detail?: string; buttons?: string[]; defaultId?: number; cancelId?: number }): Promise<{ response: number }> =>
    window.api.dialogShowMessageBox(options),
}

export const autolaunch = {
  enable: (): Promise<void> => window.api.autolaunchEnable(),
  disable: (): Promise<void> => window.api.autolaunchDisable(),
}

export const storeEvents = {
  onDidChange: (callback: (key: string, newValue: unknown, oldValue: unknown) => void) =>
    window.api.onStoreDidChange(callback),
}

export const petEvents = {
  onCursorHover: (callback: (hovered: boolean) => void) =>
    window.api.onPetCursorHover(callback),
}

export const quickNoteApi = {
  saved: (noteId: string): void =>
    window.api.quickNoteSaved(noteId),
}

export const noteEvents = {
  onNavigateToNote: (callback: (noteId: string) => void) =>
    window.api.onNavigateToNote(callback),
}

export const windowModeEvents = {
  onSetWindowMode: (callback: (mode: 'pet' | 'expanded') => void) =>
    window.api.onSetWindowMode((mode) => callback(mode as 'pet' | 'expanded')),
}
