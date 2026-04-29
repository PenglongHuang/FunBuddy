import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { IPC } from '../shared/ipc-channels'

let mainWindow: BrowserWindow | null = null

// Mode dimensions
const PET_WIDTH = 110
const PET_HEIGHT = 200
const EXPANDED_WIDTH = 480
const EXPANDED_HEIGHT = 680

function getTargetDisplay() {
  if (mainWindow) {
    const bounds = mainWindow.getBounds()
    return screen.getDisplayNearestPoint({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 })
  }
  return screen.getPrimaryDisplay()
}

export function createMainWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = display.workAreaSize

  // Start in PET MODE — small window on the right side of screen
  const startX = display.bounds.x + screenWidth - PET_WIDTH - 20
  const startY = display.bounds.y + Math.floor((screenHeight - PET_HEIGHT) / 2)

  mainWindow = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: startX,
    y: startY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'floating')

  // Pet mode uses transparent window — ignore mouse events initially
  // (renderer toggles via IPC based on hit-testing)
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/** Expand from pet mode to full panel mode */
export function expandToPanelMode(petX?: number, petY?: number): void {
  if (!mainWindow) return
  const display = getTargetDisplay()
  const { workAreaSize } = display

  // Calculate target position: expand leftward from pet position
  // If no pet position given, use current window position
  const sourceX = petX ?? mainWindow.getBounds().x
  const sourceY = petY ?? mainWindow.getBounds().y

  // Target: right-edge anchored, vertically centered
  let targetX = display.bounds.x + workAreaSize.width - EXPANDED_WIDTH
  let targetY = display.bounds.y + Math.floor((workAreaSize.height - EXPANDED_HEIGHT) / 2)

  // Clamp to screen bounds
  targetX = Math.max(display.bounds.x, Math.min(targetX, display.bounds.x + workAreaSize.width - EXPANDED_WIDTH))
  targetY = Math.max(display.bounds.y, Math.min(targetY, display.bounds.y + workAreaSize.height - EXPANDED_HEIGHT))

  mainWindow.setBounds({
    x: targetX,
    y: targetY,
    width: EXPANDED_WIDTH,
    height: EXPANDED_HEIGHT,
  })
}

/** Collapse from panel mode back to pet mode */
export function collapseToPetMode(petX?: number, petY?: number): void {
  if (!mainWindow) return

  // Use saved pet position or default right-side position
  let targetX = petX
  let targetY = petY

  if (targetX === undefined || targetY === undefined) {
    const display = getTargetDisplay()
    const { workAreaSize } = display
    targetX = display.bounds.x + workAreaSize.width - PET_WIDTH - 20
    targetY = display.bounds.y + Math.floor((workAreaSize.height - PET_HEIGHT) / 2)
  }

  mainWindow.setBounds({
    x: targetX!,
    y: targetY!,
    width: PET_WIDTH,
    height: PET_HEIGHT,
  })
}

/** Legacy alias — kept for backward compat with existing code */
export function resizeWindow(width: number, height: number): void {
  if (!mainWindow) return
  mainWindow.setSize(width, height)
  // Recalculate position to stay on right edge
  const display = getTargetDisplay()
  const x = display.bounds.x + display.workAreaSize.width - width
  const y = display.bounds.y + Math.floor((display.workAreaSize.height - height) / 2)
  mainWindow.setPosition(x, y)
}

/** Get current mode dimensions */
export function getPetDimensions() {
  return { width: PET_WIDTH, height: PET_HEIGHT }
}

export function getExpandedDimensions() {
  return { width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }
}

// --- Pet cursor tracking (main-process hit-testing) ---

let trackingInterval: ReturnType<typeof setInterval> | null = null
let trackingHovering = false
let trackingDragging = false
let dragState: {
  winStartX: number
  winStartY: number
  cursorStartX: number
  cursorStartY: number
} | null = null

const HIT_RADIUS = 45

export function startPetCursorTracking(win: BrowserWindow): void {
  stopPetCursorTracking()
  win.setIgnoreMouseEvents(true, { forward: true })
  trackingHovering = false

  trackingInterval = setInterval(() => {
    if (win.isDestroyed()) {
      stopPetCursorTracking()
      return
    }

    const cursor = screen.getCursorScreenPoint()
    const bounds = win.getBounds()

    const petCx = bounds.x + bounds.width / 2
    const petCy = bounds.y + bounds.height / 2
    const dx = cursor.x - petCx
    const dy = cursor.y - petCy
    const inside = dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS

    if (inside && !trackingHovering) {
      trackingHovering = true
      win.setIgnoreMouseEvents(false)
      win.webContents.send(IPC.PET_CURSOR_HOVER, { hovered: true })
    } else if (!inside && trackingHovering && !trackingDragging) {
      trackingHovering = false
      win.setIgnoreMouseEvents(true, { forward: true })
      win.webContents.send(IPC.PET_CURSOR_HOVER, { hovered: false })
    }
  }, 50)
}

export function stopPetCursorTracking(): void {
  if (trackingInterval) {
    clearInterval(trackingInterval)
    trackingInterval = null
  }
  trackingHovering = false
  trackingDragging = false
}

export function setPetDragging(dragging: boolean, cursorX?: number, cursorY?: number): void {
  trackingDragging = dragging
  if (!mainWindow || mainWindow.isDestroyed()) return

  if (dragging) {
    // Kill cursor tracking interval
    if (trackingInterval) {
      clearInterval(trackingInterval)
      trackingInterval = null
    }
    mainWindow.setIgnoreMouseEvents(false)

    // Store initial positions — window pos from getPosition(), cursor pos from renderer (both DIP)
    const [winX, winY] = mainWindow.getPosition()
    dragState = { winStartX: winX, winStartY: winY, cursorStartX: cursorX ?? 0, cursorStartY: cursorY ?? 0 }
  } else {
    dragState = null
    trackingDragging = false
    startPetCursorTracking(mainWindow)
  }
}

/** Move window using renderer-reported cursor coordinates (both in DIP space) */
export function movePetDrag(cursorX: number, cursorY: number): void {
  if (!mainWindow || mainWindow.isDestroyed() || !dragState) return
  mainWindow.setPosition(
    dragState.winStartX + (cursorX - dragState.cursorStartX),
    dragState.winStartY + (cursorY - dragState.cursorStartY)
  )
}
