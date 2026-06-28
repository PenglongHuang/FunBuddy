import { type ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  header?: ReactNode
  /** 自定义内容区内边距;不传则用默认 clamp(18px,4.5cqw,32px)。供个别面板需要更紧凑时覆盖。 */
  inset?: string
}

export default function GlassPanel({ children, header, inset }: GlassPanelProps) {
  const defaultPadding = header ? '0 clamp(18px, 4.5cqw, 32px) clamp(18px, 4.5cqw, 32px)' : 'clamp(18px, 4.5cqw, 32px)'
  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
      {header && (
        <div className="shrink-0">
          {header}
          <div style={{ height: 1, background: 'var(--separator)' }} />
        </div>
      )}
      <div
        className="flex-1 overflow-hidden"
        style={{ padding: inset ?? defaultPadding }}
      >
        {children}
      </div>
    </div>
  )
}
