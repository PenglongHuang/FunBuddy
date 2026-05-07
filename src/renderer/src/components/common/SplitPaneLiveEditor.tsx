import { useRef, useCallback, useEffect } from 'react'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import MarkdownPreview from '@/components/common/MarkdownPreview'

interface SplitPaneLiveEditorProps {
  value: string
  onChange: (value: string) => void
  onCursorLineChange?: (lineIndex: number | null) => void
  placeholder?: string
}

export default function SplitPaneLiveEditor({ value, onChange, onCursorLineChange, placeholder }: SplitPaneLiveEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewPaneRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  const handleEditorScroll = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true

    const textarea = containerRef.current?.querySelector('textarea')
    const preview = previewPaneRef.current
    if (textarea && preview) {
      const maxEditor = textarea.scrollHeight - textarea.clientHeight
      const ratio = maxEditor > 0 ? textarea.scrollTop / maxEditor : 0
      const maxPreview = preview.scrollHeight - preview.clientHeight
      preview.scrollTop = ratio * maxPreview
    }

    requestAnimationFrame(() => { syncingRef.current = false })
  }, [])

  useEffect(() => {
    const textarea = containerRef.current?.querySelector('textarea')
    if (!textarea) return
    textarea.addEventListener('scroll', handleEditorScroll, { passive: true })
    return () => textarea.removeEventListener('scroll', handleEditorScroll)
  }, [handleEditorScroll])

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Editor pane */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <MarkdownEditor
          value={value}
          onChange={onChange}
          onCursorLineChange={onCursorLineChange}
          placeholder={placeholder}
        />
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: 'var(--separator)', flexShrink: 0 }} />

      {/* Preview pane */}
      <div ref={previewPaneRef} className="live-preview-pane" style={{ flex: 1, overflow: 'auto', minWidth: 0, minHeight: 0, padding: '0 8px' }}>
        <MarkdownPreview content={value} />
      </div>
    </div>
  )
}
