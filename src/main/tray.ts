import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'

let tray: Tray | null = null

function pointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function createFallbackIcon(): Electron.NativeImage {
  const size = 48
  const buffer = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2

  const outerR = 22
  const innerR = 9
  const vertices: [number, number][] = []
  for (let i = 0; i < 5; i++) {
    const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    vertices.push([cx + outerR * Math.cos(outerAngle), cy + outerR * Math.sin(outerAngle)])
    const innerAngle = outerAngle + Math.PI / 5
    vertices.push([cx + innerR * Math.cos(innerAngle), cy + innerR * Math.sin(innerAngle)])
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      if (pointInPolygon(x, y, vertices)) {
        const t = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / outerR
        buffer[idx] = 255
        buffer[idx + 1] = Math.round(230 - t * 30)
        buffer[idx + 2] = Math.round(60 - t * 40)
        buffer[idx + 3] = 255

        const leftEyeX = cx - 4.5
        const rightEyeX = cx + 4.5
        const eyeY = cy + 1.5
        const eyeR = 2.8
        const isLeftEye = Math.sqrt((x - leftEyeX) ** 2 + (y - eyeY) ** 2) <= eyeR
        const isRightEye = Math.sqrt((x - rightEyeX) ** 2 + (y - eyeY) ** 2) <= eyeR

        if (isLeftEye || isRightEye) {
          buffer[idx] = 93
          buffer[idx + 1] = 64
          buffer[idx + 2] = 55
        }
      } else {
        buffer[idx + 3] = 0
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size })
}

function loadIcon(): Electron.NativeImage {
  // Try multiple paths for the SVG/PNG icon
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(__dirname, '../../resources/icon.svg'),
    join(process.resourcesPath || '', 'resources/icon.png'),
    join(process.resourcesPath || '', 'resources/icon.svg'),
  ]

  for (const path of candidates) {
    try {
      const buf = readFileSync(path)
      const img = nativeImage.createFromBuffer(buf)
      if (!img.isEmpty()) return img.resize({ width: 32, height: 32 })
    } catch {
      // Try next candidate
    }
  }

  // Fallback: programmatic icon
  console.warn('Using fallback tray icon')
  return createFallbackIcon().resize({ width: 32, height: 32 })
}

export function createTray(): void {
  const icon = loadIcon()
  tray = new Tray(icon)
  tray.setToolTip('FunPets')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 FunPets',
      click: () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.show()
          win.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.show()
      win.focus()
    }
  })
}
