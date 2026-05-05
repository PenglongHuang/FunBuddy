// src/renderer/src/components/common/LiveMarkdownEditor.tsx
import { useState, useRef, useCallback, useMemo } from 'react'
import { marked } from 'marked'
import { parseBlocks, replaceBlockInSource, type Block } from '@/lib/block-parser'

interface LiveMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onCursorLineChange?: (lineIndex: number | null) => void
  placeholder?: string
}

export default function LiveMarkdownEditor({ value, onChange, onCursorLineChange, placeholder }: LiveMarkdownEditorProps) {
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map())

  const blocks = useMemo(() => parseBlocks(value), [value])

  const handleBlockFocus = useCallback((index: number) => {
    setActiveBlockIndex(index)
    if (onCursorLineChange) {
      onCursorLineChange(blocks[index]?.startLine ?? null)
    }
  }, [blocks, onCursorLineChange])

  const handleBlockBlur = useCallback(() => {
    setActiveBlockIndex(null)
  }, [])

  const handleBlockChange = useCallback((index: number, newContent: string) => {
    const block = blocks[index]
    if (!block) return
    const newSource = replaceBlockInSource(value, block, newContent)
    onChange(newSource)
  }, [blocks, value, onChange])

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  const renderBlock = (block: Block, index: number) => {
    const isActive = activeBlockIndex === index

    if (isActive) {
      return (
        <textarea
          key={`edit-${index}`}
          ref={(el) => { if (el) { textareaRefs.current.set(index, el); autoResize(el) } }}
          value={block.content}
          onChange={(e) => { handleBlockChange(index, e.target.value); autoResize(e.target) }}
          onFocus={() => handleBlockFocus(index)}
          onBlur={handleBlockBlur}
          autoFocus
          style={{
            width: '100%',
            minHeight: 24,
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(10,132,255,0.20)',
            borderRadius: 4,
            padding: '6px 8px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
            display: 'block',
            boxSizing: 'border-box',
          }}
        />
      )
    }

    if (block.content.trim() === '' && block.type === 'paragraph') {
      return (
        <div
          key={`render-${index}`}
          onClick={() => handleBlockFocus(index)}
          style={{ minHeight: 24, cursor: 'text', borderRadius: 4, padding: '6px 8px', color: 'var(--text-quaternary)', fontSize: 12 }}
        >
          {placeholder ?? ''}
        </div>
      )
    }

    const html = block.type === 'hr'
      ? '<hr/>'
      : (marked.parse(block.content, { async: false }) as string)

    return (
      <div
        key={`render-${index}`}
        onClick={() => handleBlockFocus(index)}
        style={{
          cursor: 'text',
          borderRadius: 4,
          padding: '6px 8px',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--text-primary)',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto"
      style={{ padding: '8px 0' }}
    >
      {blocks.length === 0 ? (
        <div
          onClick={() => {
            onChange('# 标题\n\n')
            setTimeout(() => setActiveBlockIndex(0), 0)
          }}
          style={{ padding: '8px', color: 'var(--text-quaternary)', fontSize: 12, cursor: 'text' }}
        >
          {placeholder ?? '# 标题\n\n'}
        </div>
      ) : (
        blocks.map((block, index) => renderBlock(block, index))
      )}
    </div>
  )
}
