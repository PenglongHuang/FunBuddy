import { useEffect, useRef, useState, useCallback } from 'react'
import { extractHeadings } from '@/lib/toc-extract'
import 'vditor/dist/index.css'
import '@/styles/vditor-theme.css'

interface LiveMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onCursorLineChange?: (lineIndex: number | null) => void
  placeholder?: string
}

export default function LiveMarkdownEditor({ value, onChange, onCursorLineChange, placeholder }: LiveMarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const vditorRef = useRef<any>(null)
  const initialValueRef = useRef(value)
  const lastSyncedRef = useRef(value)
  const [fallback, setFallback] = useState(false)
  const [loading, setLoading] = useState(true)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onCursorLineChangeRef = useRef(onCursorLineChange)
  onCursorLineChangeRef.current = onCursorLineChange

  const handleCursorTracking = useCallback(() => {
    if (!onCursorLineChangeRef.current || !vditorRef.current) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    let node = sel.anchorNode as HTMLElement | null
    if (!node) return
    while (node && node !== containerRef.current) {
      if (node.nodeType === 1) {
        const el = node as HTMLElement
        const tag = el.tagName
        if (['H1','H2','H3','H4','H5','H6'].includes(tag)) {
          const text = el.textContent?.trim() ?? ''
          const md = vditorRef.current.getValue()
          const headings = extractHeadings(md)
          const match = headings.find(h => h.text === text)
          if (match) {
            onCursorLineChangeRef.current(match.lineIndex)
            return
          }
        }
      }
      node = node.parentElement
    }
    onCursorLineChangeRef.current(null)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    let destroyed = false

    const initVditor = async () => {
      try {
        const Vditor = (await import('vditor')).default
        if (destroyed || !containerRef.current) return

        const vditor = new Vditor(containerRef.current, {
          mode: 'ir',
          toolbar: false,
          counter: { enable: true },
          outline: { enable: false },
          placeholder: placeholder ?? '# 标题\n\n内容...',
          theme: 'dark',
          icon: 'ant',
          value: initialValueRef.current,
          input: (val) => {
            lastSyncedRef.current = val
            onChangeRef.current(val)
          },
          after: () => {
            if (destroyed) return
            setLoading(false)
            lastSyncedRef.current = initialValueRef.current
          },
        })
        vditorRef.current = vditor
      } catch (err) {
        console.error('Vditor init failed, falling back to textarea:', err)
        setFallback(true)
        setLoading(false)
      }
    }

    initVditor()

    return () => {
      destroyed = true
      if (vditorRef.current) {
        try { vditorRef.current.destroy() } catch {}
        vditorRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!vditorRef.current) return
    if (value !== lastSyncedRef.current) {
      lastSyncedRef.current = value
      vditorRef.current.setValue(value)
    }
  }, [value])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = () => handleCursorTracking()
    el.addEventListener('keyup', handler)
    el.addEventListener('click', handler)
    return () => {
      el.removeEventListener('keyup', handler)
      el.removeEventListener('click', handler)
    }
  }, [handleCursorTracking])

  if (fallback) {
    return (
      <textarea
        className="w-full h-full bg-transparent text-xs text-white/80 font-mono resize-none outline-none placeholder:text-white/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
    )
  }

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {loading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-quaternary)', fontSize: 12,
          background: 'rgba(28,28,30,0.5)',
        }}>
          加载编辑器...
        </div>
      )}
    </div>
  )
}
