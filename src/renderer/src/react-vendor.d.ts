import type {} from 'react'

declare module 'react' {
  interface CSSProperties {
    /** Electron/Chromium `-webkit-app-region`：声明可拖拽区域。 */
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
