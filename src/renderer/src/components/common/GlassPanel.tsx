import { type ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  header?: ReactNode
}

export default function GlassPanel({ children, header }: GlassPanelProps) {
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
        style={{ padding: header ? '0 clamp(18px, 4.5cqw, 32px) clamp(18px, 4.5cqw, 32px)' : 'clamp(18px, 4.5cqw, 32px)' }}
      >
        {children}
      </div>
    </div>
  )
}
