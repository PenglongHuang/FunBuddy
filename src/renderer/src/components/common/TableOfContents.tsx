import { useMemo, useEffect, useRef } from 'react'
import { extractHeadings } from '@/lib/toc-extract'
import { X } from 'lucide-react'

interface TableOfContentsProps {
  content: string
  maxLevel: number
  currentLineIndex: number | null
  onHeadingClick: (lineIndex: number) => void
  onClose: () => void
  open: boolean
}

export default function TableOfContents({ content, maxLevel, currentLineIndex, onHeadingClick, onClose, open }: TableOfContentsProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const headings = useMemo(() => extractHeadings(content, maxLevel), [content, maxLevel])

  const activeHeadingLine = useMemo(() => {
    if (currentLineIndex === null || headings.length === 0) return null
    let active: number | null = null
    for (const h of headings) {
      if (h.lineIndex <= currentLineIndex) active = h.lineIndex
      else break
    }
    return active
  }, [headings, currentLineIndex])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  if (headings.length === 0) {
    return (
      <div ref={panelRef} style={{
        position: 'absolute', top: 52, right: 8, zIndex: 50,
        width: 200, background: 'rgba(30,30,35,0.95)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        padding: '20px 16px', textAlign: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>暂无标题</span>
      </div>
    )
  }

  const renderHeadings = () => (
    headings.map((h, idx) => {
      const isActive = h.lineIndex === activeHeadingLine
      const indent = (h.level - 1) * 14
      const hasNextSibling = headings.some((other, i) => i > idx && other.level === h.level)

      return (
        <div key={h.lineIndex} style={{ position: 'relative' }}>
          {h.level > 1 && (
            <div style={{
              position: 'absolute', left: 14 + (h.level - 2) * 14, top: 0, bottom: hasNextSibling ? 0 : '50%',
              width: 1, background: 'rgba(255,255,255,0.06)',
            }} />
          )}
          <div
            onClick={() => onHeadingClick(h.lineIndex)}
            style={{
              fontSize: h.level === 1 ? 12 : 11,
              padding: '3px 8px',
              paddingLeft: 8 + indent,
              color: isActive ? 'var(--accent-blue)' : 'var(--text-tertiary)',
              background: isActive ? 'rgba(10,132,255,0.08)' : 'transparent',
              borderLeft: isActive ? '2px solid rgba(10,132,255,0.6)' : '2px solid transparent',
              borderRadius: '0 4px 4px 0',
              cursor: 'pointer',
              fontWeight: isActive ? 500 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s ease, background 0.15s ease',
              lineHeight: '22px',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
          >
            {h.text}
          </div>
        </div>
      )
    })
  )

  return (
    <div ref={panelRef} style={{
      position: 'absolute', top: 52, right: 8, zIndex: 50,
      width: 220, maxHeight: '80%',
      background: 'rgba(30,30,35,0.95)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      overflow: 'hidden',
      animation: 'toc-fade-in 0.15s ease-out',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, padding: '10px 14px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        color: 'var(--text-quaternary)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>目录</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-quaternary)', padding: 0, display: 'flex',
        }}>
          <X size={12} />
        </button>
      </div>
      <div style={{ padding: '6px 0', overflowY: 'auto', maxHeight: 240 }}>
        {renderHeadings()}
      </div>
    </div>
  )
}
