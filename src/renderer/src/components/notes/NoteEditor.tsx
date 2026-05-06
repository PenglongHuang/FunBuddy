import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNoteStore } from '@/stores/noteStore'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import MarkdownPreview from '@/components/common/MarkdownPreview'
import LiveMarkdownEditor from '@/components/common/LiveMarkdownEditor'
import TableOfContents from '@/components/common/TableOfContents'
import { ArrowLeft, Pencil, Eye, Zap, List } from 'lucide-react'
import TagInput from '@/components/common/TagInput'
import { getAllTags } from '@/lib/tag-utils'
import { motion } from 'motion/react'
import { useToast } from '@/components/common/Toast'
import { extractH1Title } from '@/utils/markdown'
import { usePetStore } from '@/stores/petStore'
import { extractHeadings } from '@/lib/toc-extract'

const AUTO_SAVE_DELAY = 3000

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement
  while (parent) {
    const { overflowY } = getComputedStyle(parent)
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

function scrollToElement(el: HTMLElement) {
  const container = findScrollParent(el)
  if (!container) return
  const containerRect = container.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  container.scrollTo({
    top: container.scrollTop + elRect.top - containerRect.top,
    behavior: 'smooth',
  })
}

export default function NoteEditor() {
  const activeNoteId = useNoteStore((s) => s.activeNoteId)
  const note = useNoteStore((s) => s.notes.find((n) => n.id === activeNoteId))
  const loadNoteContent = useNoteStore((s) => s.loadNoteContent)
  const saveNoteContent = useNoteStore((s) => s.saveNoteContent)
  const updateNoteTitle = useNoteStore((s) => s.updateNoteTitle)
  const updateNoteTags = useNoteStore((s) => s.updateNoteTags)
  const setActiveNote = useNoteStore((s) => s.setActiveNote)
  const notes = useNoteStore((s) => s.notes)

  const allTags = useMemo(() => getAllTags(notes), [notes])

  const tocMaxLevel = useNoteStore((s) => s.tocMaxLevel)
  const setTocVisibleGlobal = usePetStore((s) => s.setTocVisible)

  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'live' | 'edit' | 'preview'>(
    () => useNoteStore.getState().editorMode
  )
  const [tocVisible, setTocVisible] = useState(false)
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(0)
  const [dirty, setDirty] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const contentRef = useRef(content)
  contentRef.current = content
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  const toggleTocRef = useRef<() => void>(() => {})
  const editorRef = useRef<HTMLDivElement>(null)

  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    if (activeNoteId) {
      loadNoteContent(activeNoteId).then((c) => {
        setContent(c)
        setDirty(false)
      })
    }
  }, [activeNoteId, loadNoteContent])

  const doSave = useCallback(async (isAuto: boolean) => {
    if (!note) return
    await saveNoteContent(note.id, contentRef.current)

    const h1 = extractH1Title(contentRef.current)
    if (h1 && h1 !== note.title) {
      await updateNoteTitle(note.id, h1)
    }

    setDirty(false)
    showToast(isAuto ? '自动保存成功' : '保存成功')
  }, [note, saveNoteContent, updateNoteTitle, showToast])

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        doSave(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [doSave])

  // Cleanup: save dirty content on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      if (dirtyRef.current) {
        const store = useNoteStore.getState()
        const { activeNoteId } = store
        const currentNote = store.notes.find((n) => n.id === activeNoteId)
        if (currentNote) {
          store.saveNoteContent(currentNote.id, contentRef.current)
          const h1 = extractH1Title(contentRef.current)
          if (h1 && h1 !== currentNote.title) {
            store.updateNoteTitle(currentNote.id, h1)
          }
        }
      }
    }
  }, [])

  // Ctrl+Shift+O handler — toggle TOC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
        e.preventDefault()
        toggleTocRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!note) return null

  const handleChange = (newContent: string) => {
    setContent(newContent)
    setDirty(true)

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => doSave(true), AUTO_SAVE_DELAY)
  }

  const toggleToc = () => {
    setTocVisible(!tocVisible)
    setTocVisibleGlobal(!tocVisible)
  }
  toggleTocRef.current = toggleToc

  const handleHeadingClick = (lineIndex: number) => {
    setCurrentLineIndex(lineIndex)
    if (!editorRef.current) return

    if (mode === 'edit') {
      const textarea = editorRef.current.querySelector('textarea')
      if (textarea) {
        const lines = content.split('\n')
        let pos = 0
        for (let i = 0; i < lineIndex; i++) pos += (lines[i]?.length ?? 0) + 1
        textarea.focus()
        textarea.setSelectionRange(pos, pos)
        textarea.scrollTop = lineIndex * 20
      }
      return
    }

    if (mode === 'live') {
      const headings = extractHeadings(content, tocMaxLevel)
      const targetIdx = headings.findIndex(h => h.lineIndex === lineIndex)
      if (targetIdx !== -1) {
        const headingEls = editorRef.current.querySelectorAll('.vditor-ir h1, .vditor-ir h2, .vditor-ir h3, .vditor-ir h4, .vditor-ir h5, .vditor-ir h6')
        if (headingEls.length > targetIdx) {
          const el = headingEls[targetIdx] as HTMLElement
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
      return
    }

    // preview mode
    const headings = extractHeadings(content, tocMaxLevel)
    const targetIdx = headings.findIndex(h => h.lineIndex === lineIndex)
    if (targetIdx !== -1) {
      const headingEls = editorRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')
      if (headingEls.length > targetIdx) {
        scrollToElement(headingEls[targetIdx] as HTMLElement)
      }
    }
  }

  return (
    <div className="flex flex-col h-full gap-3" style={{ position: 'relative' }}>
      <ToastContainer />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => {
            if (tocVisible) {
              setTocVisible(false)
              setTocVisibleGlobal(false)
            }
            setActiveNote(null)
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          style={{
            width: 30, height: 30, borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-tertiary)', border: 'none',
            color: 'var(--text-tertiary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <ArrowLeft size={15} />
        </motion.button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: note.color, flexShrink: 0 }} />
          <span className="truncate" style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600 }}>
            {note.title}
          </span>
          {dirty && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-orange)', flexShrink: 0 }} />
          )}
        </div>

        {/* TOC toggle */}
        <motion.button
          onClick={toggleToc}
          whileTap={{ scale: 0.9 }}
          title="目录 (Ctrl+Shift+O)"
          style={{
            width: 24, height: 24, borderRadius: 5,
            background: tocVisible ? 'rgba(10,132,255,0.15)' : 'transparent',
            border: tocVisible ? '0.5px solid rgba(10,132,255,0.30)' : 'none',
            color: tocVisible ? 'var(--accent-blue)' : 'var(--text-quaternary)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s ease, color 0.2s ease',
          }}
        >
          <List size={12} />
        </motion.button>

        {/* Mode toggle */}
        <div className="flex gap-0.5" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          {([
            ['live', Zap],
            ['edit', Pencil],
            ['preview', Eye],
          ] as const).map(([m, Icon]) => (
            <motion.button
              key={m}
              onClick={() => {
                setMode(m)
                useNoteStore.getState().setEditorMode(m)
              }}
              whileTap={{ scale: 0.9 }}
              style={{
                width: 28, height: 24, borderRadius: 5,
                background: mode === m ? 'var(--accent-blue)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-quaternary)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s ease, color 0.2s ease',
              }}
            >
              <Icon size={12} />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <TagInput
        tags={note.tags ?? []}
        allTags={allTags}
        onUpdateTags={(tags) => updateNoteTags(note.id, tags)}
        placeholder="添加标签..."
      />

      {/* Editor / Preview */}
      <div ref={editorRef} className="flex-1 min-h-0" style={{ overflow: 'auto', position: 'relative' }}>
        {mode === 'live' ? (
          <LiveMarkdownEditor key={activeNoteId} value={content} onChange={handleChange} onCursorLineChange={setCurrentLineIndex} />
        ) : mode === 'edit' ? (
          <MarkdownEditor value={content} onChange={handleChange} onCursorLineChange={setCurrentLineIndex} placeholder="# 标题\n\n内容..." />
        ) : (
          <MarkdownPreview content={content} />
        )}
        <TableOfContents
          content={content}
          maxLevel={tocMaxLevel}
          currentLineIndex={currentLineIndex}
          onHeadingClick={handleHeadingClick}
          onClose={() => { setTocVisible(false); setTocVisibleGlobal(false) }}
          open={tocVisible}
        />
      </div>
    </div>
  )
}
