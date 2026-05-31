import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { searchLinks, type LinkSearchResult } from '@/lib/link-resolver'
import { FileText, StickyNote } from 'lucide-react'

interface LinkSuggestionPopupProps {
  anchorRect: { x: number; y: number }
  onSelect: (result: LinkSearchResult) => void
  onClose: () => void
}

export default function LinkSuggestionPopup({ anchorRect, onSelect, onClose }: LinkSuggestionPopupProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LinkSearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const popupW = 280
  const vw = window.innerWidth
  const vh = window.innerHeight
  const flipUp = anchorRect.y + 320 > vh - 8
  let left = anchorRect.x
  if (left + popupW > vw - 8) left = vw - popupW - 8
  left = Math.max(8, left)

  useEffect(() => {
    searchLinks('').then(setResults)
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    searchLinks(query).then(r => {
      setResults(r)
      setSelectedIndex(0)
    })
  }, [query])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        onSelect(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      e.preventDefault()
      onClose()
    }
  }, [results, selectedIndex, onSelect, onClose])

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Close on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left,
        ...(flipUp
          ? { bottom: vh - anchorRect.y + 4 }
          : { top: anchorRect.y }),
        zIndex: 10000,
        width: popupW,
        maxHeight: 320,
        background: 'rgba(40, 40, 44, 0.98)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索计划或笔记..."
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          color: 'var(--text-primary)',
          fontSize: 12,
          outline: 'none',
        }}
      />
      <div
        ref={listRef}
        style={{
          overflowY: 'auto',
          maxHeight: 270,
          padding: '4px 0',
        }}
      >
        {results.length === 0 && (
          <div style={{ padding: '12px', color: 'var(--text-quaternary)', fontSize: 12, textAlign: 'center' }}>
            无匹配结果
          </div>
        )}
        {results.map((r, i) => (
          <div
            key={`${r.type}-${r.id}`}
            onClick={() => onSelect(r)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              background: i === selectedIndex ? 'rgba(10,132,255,0.15)' : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            {r.type === 'plan' ? (
              <FileText size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
            ) : (
              <StickyNote size={13} style={{ color: '#c084fc', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.title}
            </span>
            {r.tags.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-quaternary)', flexShrink: 0 }}>
                {r.tags.slice(0, 2).join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
