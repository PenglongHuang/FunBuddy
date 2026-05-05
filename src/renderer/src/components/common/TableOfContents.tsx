import { useMemo } from 'react'
import { extractHeadings, type TocHeading } from '@/lib/toc-extract'
import { X } from 'lucide-react'

interface TableOfContentsProps {
  content: string
  maxLevel: number
  currentLineIndex: number | null
  onHeadingClick: (lineIndex: number) => void
  onClose: () => void
}

export default function TableOfContents({ content, maxLevel, currentLineIndex, onHeadingClick, onClose }: TableOfContentsProps) {
  const headings = useMemo(() => extractHeadings(content, maxLevel), [content, maxLevel])

  // Find which heading the current line belongs to
  const activeHeadingLine = useMemo(() => {
    if (currentLineIndex === null || headings.length === 0) return null
    let active: number | null = null
    for (const h of headings) {
      if (h.lineIndex <= currentLineIndex) active = h.lineIndex
      else break
    }
    return active
  }, [headings, currentLineIndex])

  if (headings.length === 0) {
    return (
      <div style={{ width: 140, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-quaternary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span>目录</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-quaternary)', padding: 0, display: 'flex' }}>
            <X size={10} />
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <span style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>暂无标题</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: 140, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-quaternary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span>目录</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-quaternary)', padding: 0, display: 'flex' }}>
          <X size={10} />
        </button>
      </div>
      <div style={{ flex: 1, padding: '6px 4px', overflowY: 'auto', fontSize: 10 }}>
        {headings.map((h) => {
          const isActive = h.lineIndex === activeHeadingLine
          const indent = (h.level - 1) * 8
          return (
            <div
              key={h.lineIndex}
              onClick={() => onHeadingClick(h.lineIndex)}
              style={{
                padding: '3px 5px',
                paddingLeft: 5 + indent,
                color: isActive ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                background: isActive ? 'rgba(10,132,255,0.1)' : 'transparent',
                borderRadius: 4,
                cursor: 'pointer',
                marginBottom: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: isActive ? 500 : 400,
                transition: 'color 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {h.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}
