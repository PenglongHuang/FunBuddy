import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNoteStore } from '@/stores/noteStore'
import { useNavigationStore } from '@/stores/navigationStore'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import MarkdownPreview from '@/components/common/MarkdownPreview'
import SplitPaneLiveEditor from '@/components/common/SplitPaneLiveEditor'
import TableOfContents from '@/components/common/TableOfContents'
import { ArrowLeft, Pencil, Eye, Zap, List, Download, MoreVertical } from 'lucide-react'
import TagInput from '@/components/common/TagInput'
import { getAllTags } from '@/lib/tag-utils'
import { motion } from 'motion/react'
import { useToast } from '@/components/common/Toast'
import { extractH1Title } from '@/utils/markdown'
import { extractHeadings } from '@/lib/toc-extract'
import MarkdownContextMenu from '@/components/ui/MarkdownContextMenu'
import useTextSelection from '@/hooks/useTextSelection'
import { applyOperationToTextarea, createInsertImageWithPath, createInsertLinkRef } from '@/lib/markdown-operations'
import { type LinkSearchResult } from '@/lib/link-resolver'
import { imageApi, fs } from '@/lib/ipc'
import LinkSuggestionPopup from '@/components/common/LinkSuggestionPopup'
import ContextMenu from '@/components/ui/ContextMenu'
import ExportDialog from '@/components/common/ExportDialog'
import { buildExportHtml, type ExportMode } from '@/lib/export-pdf'
import { pdfExport } from '@/lib/ipc'
import { useToastStore } from '@/stores/toastStore'

const AUTO_SAVE_DELAY = 3000

const IMAGE_REF_REGEX = /!\[[^\]]*\]\([^)]*\/assets\/([^)]+)\)/g

async function cleanupOrphanImages(mdFilePath: string, content: string): Promise<void> {
  const refs = new Set<string>()
  let match
  while ((match = IMAGE_REF_REGEX.exec(content)) !== null) {
    if (match[1]) refs.add(match[1])
  }
  if (refs.size === 0) return
  try {
    const dir = mdFilePath.replace(/\.md$/, '')
    const assetsPath = `${dir}/assets`
    const files = await fs.readDir(assetsPath)
    for (const file of files) {
      if (!refs.has(file)) {
        await imageApi.deleteImage(mdFilePath, file)
      }
    }
  } catch { /* no assets dir */ }
}

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
  const notes = useNoteStore((s) => s.notes)
  const navPush = useNavigationStore((s) => s.push)

  const allTags = useMemo(() => getAllTags(notes), [notes])

  const tocMaxLevel = useNoteStore((s) => s.tocMaxLevel)

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
  const prevImageRefsRef = useRef<Set<string>>(new Set())
  const toggleTocRef = useRef<() => void>(() => {})
  const editorRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const [contextMenuState, setContextMenuState] = useState<{
    anchorRect: DOMRect
    mode: 'edit' | 'live' | 'preview'
    selection: { start: number; end: number } | null
  } | null>(null)
  const [textareaEl, setTextareaEl] = useState<HTMLTextAreaElement | null>(null)
  const selection = useTextSelection(textareaEl)

  const [linkPopupState, setLinkPopupState] = useState<{
    anchorRect: { x: number; y: number }
    triggerStart: number
  } | null>(null)

  const [editorContextMenu, setEditorContextMenu] = useState<DOMRect | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

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

    // Orphan image cleanup — only when image refs changed
    const currentRefs = new Set<string>()
    let match
    while ((match = IMAGE_REF_REGEX.exec(contentRef.current)) !== null) {
      if (match[1]) currentRefs.add(match[1])
    }
    if (currentRefs.size > 0 || prevImageRefsRef.current.size > 0) {
      if (currentRefs.size !== prevImageRefsRef.current.size ||
          [...currentRefs].some(r => !prevImageRefsRef.current.has(r))) {
        await cleanupOrphanImages(note.filePath, contentRef.current)
      }
    }
    prevImageRefsRef.current = currentRefs

    setDirty(false)
    showToast(isAuto ? '自动保存成功' : '保存成功')
  }, [note, saveNoteContent, updateNoteTitle, showToast])

  const doSaveRef = useRef(doSave)
  doSaveRef.current = doSave

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        doSaveRef.current(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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

  // Capture textarea element for useTextSelection (re-runs on mode/note change)
  useEffect(() => {
    if (editorRef.current) {
      const ta = editorRef.current.querySelector('textarea') as HTMLTextAreaElement | null
      setTextareaEl(ta)
    }
  }, [activeNoteId, mode])

  const handleTriggerLinkPopup = useCallback((triggerStart: number) => {
    if (!textareaEl) return
    const rect = textareaEl.getBoundingClientRect()
    const lineHeight = 18
    const textBefore = content.substring(0, triggerStart)
    const lineCount = textBefore.split('\n').length - 1
    setLinkPopupState({
      anchorRect: {
        x: rect.left + 10,
        y: rect.top + Math.min(lineCount * lineHeight, rect.height - 50),
      },
      triggerStart,
    })
  }, [textareaEl, content])

  const handleLinkSelect = useCallback((result: LinkSearchResult) => {
    if (!linkPopupState || !textareaEl) return
    const triggerStart = linkPopupState.triggerStart
    const currentCursorPos = textareaEl.selectionStart
    const cleanedText = content.substring(0, triggerStart) + content.substring(currentCursorPos)
    const op = createInsertLinkRef(result.id, result.title)
    const opResult = op(cleanedText, triggerStart, triggerStart)
    applyOperationToTextarea(textareaEl, content, opResult.text, opResult.start, opResult.end)
    setLinkPopupState(null)
  }, [linkPopupState, textareaEl, content])

  const handleLinkPopupClose = useCallback(() => {
    if (!linkPopupState || !textareaEl) { setLinkPopupState(null); return }
    const triggerStart = linkPopupState.triggerStart
    const currentCursorPos = textareaEl.selectionStart
    const triggerLen = currentCursorPos - triggerStart
    if (triggerLen > 0 && triggerLen <= 2) {
      const cleaned = content.substring(0, triggerStart) + content.substring(currentCursorPos)
      applyOperationToTextarea(textareaEl, content, cleaned, triggerStart, triggerStart)
    }
    setLinkPopupState(null)
  }, [linkPopupState, textareaEl, content])

  const handleLinkClick = useCallback((id: string, type: string) => {
    if (type === 'note') {
      navPush({ panel: 'notes', subView: 'editor', noteId: id })
    } else if (type === 'plan') {
      navPush({ panel: 'planner', subView: 'editor', planId: id })
    }
  }, [navPush])

  // Close link popup when trigger chars are deleted
  useEffect(() => {
    if (!linkPopupState) return
    const start = linkPopupState.triggerStart
    const firstChar = content[start]
    const twoChars = content.substring(start, start + 2)
    if (firstChar !== '@' && twoChars !== '[[') {
      setLinkPopupState(null)
    }
  }, [content, linkPopupState])

  if (!note) return null

  const handleChange = useCallback((newContent: string) => {
    setContent(newContent)
    setDirty(true)

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => doSave(true), AUTO_SAVE_DELAY)
  }, [doSave])

  const toggleToc = () => {
    setTocVisible(!tocVisible)
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
        const style = getComputedStyle(textarea)
        const measure = document.createElement('div')
        measure.style.cssText = [
          'position:absolute', 'visibility:hidden', 'white-space:pre-wrap',
          'word-wrap:break-word', `width:${style.width}`, `font:${style.font}`,
          `padding:${style.padding}`, `border:${style.border}`,
          `line-height:${style.lineHeight}`, `letter-spacing:${style.letterSpacing}`,
        ].join(';')
        measure.textContent = content.substring(0, pos)
        document.body.appendChild(measure)
        textarea.scrollTop = measure.offsetHeight - parseInt(style.paddingTop || '0')
        document.body.removeChild(measure)
      }
      return
    }

    if (mode === 'live') {
      const textarea = editorRef.current.querySelector('textarea')
      if (textarea) {
        const lines = content.split('\n')
        let pos = 0
        for (let i = 0; i < lineIndex; i++) pos += (lines[i]?.length ?? 0) + 1
        textarea.focus()
        textarea.setSelectionRange(pos, pos)
        const style = getComputedStyle(textarea)
        const measure = document.createElement('div')
        measure.style.cssText = [
          'position:absolute', 'visibility:hidden', 'white-space:pre-wrap',
          'word-wrap:break-word', `width:${style.width}`, `font:${style.font}`,
          `padding:${style.padding}`, `border:${style.border}`,
          `line-height:${style.lineHeight}`, `letter-spacing:${style.letterSpacing}`,
        ].join(';')
        measure.textContent = content.substring(0, pos)
        document.body.appendChild(measure)
        textarea.scrollTop = measure.offsetHeight - parseInt(style.paddingTop || '0')
        document.body.removeChild(measure)
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

  const handleEditorContextMenu = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const ta = e.currentTarget
    setContextMenuState({
      anchorRect: DOMRect.fromRect({ width: 0, height: 0, x: e.clientX, y: e.clientY }),
      mode,
      selection: { start: ta.selectionStart, end: ta.selectionEnd },
    })
  }, [mode])

  const handleApplyOperation = useCallback((newText: string, cursorStart: number, cursorEnd: number) => {
    if (!textareaEl) return
    applyOperationToTextarea(textareaEl, content, newText, cursorStart, cursorEnd)
    setContextMenuState(null)
  }, [content, textareaEl])

  const handleInsertImageFromPicker = useCallback(async () => {
    if (!note || !textareaEl) return
    try {
      const result = await imageApi.pickAndSave(note.filePath)
      if (!result) return
      const op = createInsertImageWithPath(result.relativePath, result.fileName)
      const res = op(content, textareaEl.selectionStart, textareaEl.selectionEnd)
      applyOperationToTextarea(textareaEl, content, res.text, res.start, res.end)
    } catch {
      showToast('保存图片失败')
    }
  }, [note, content, textareaEl, showToast])

  const handlePreviewContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuState({
      anchorRect: DOMRect.fromRect({ width: 0, height: 0, x: e.clientX, y: e.clientY }),
      mode: 'preview',
      selection: null,
    })
  }, [])

  const handleLivePreviewContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuState({
      anchorRect: DOMRect.fromRect({ width: 0, height: 0, x: e.clientX, y: e.clientY }),
      mode: 'preview',
      selection: null,
    })
  }, [])

  const handleExport = async (mode: ExportMode) => {
    if (!note) return
    try {
      const content = await loadNoteContent(activeNoteId!)
      const html = await buildExportHtml({
        content: content || '',
        mdFilePath: note.filePath,
        title: note.title,
        mode,
        fileName: `${note.title}.pdf`,
        meta: {
          tags: note.tags,
          createdAt: note.createdAt?.slice(0, 10),
        },
      })
      const result = await pdfExport.generate(html, `${note.title}.pdf`)
      setExportOpen(false)
      if (result.success && 'filePath' in result) {
        useToastStore.getState().show('PDF 导出成功')
      } else if (!result.success) {
        useToastStore.getState().show('导出失败: ' + result.error)
      }
    } catch (err: any) {
      setExportOpen(false)
      useToastStore.getState().show('导出失败: ' + (err.message || String(err)))
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col h-full gap-3" style={{ position: 'relative' }}>
      <ToastContainer />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => {
            if (tocVisible) {
              setTocVisible(false)
            }
            navPush({ panel: 'notes', subView: 'list' })
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
            ['edit', Pencil],
            ['live', Zap],
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

        <button
          onClick={(e) => setEditorContextMenu(e.currentTarget.getBoundingClientRect())}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-quaternary)', padding: 4, borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Tags */}
      <TagInput
        tags={note.tags ?? []}
        allTags={allTags}
        onUpdateTags={(tags) => updateNoteTags(note.id, tags)}
        placeholder="添加标签..."
      />

      {/* Editor / Preview */}
      <div ref={editorRef} className="flex-1 min-h-0" style={{ overflow: mode === 'preview' ? 'auto' : 'hidden' }}>
        {mode === 'live' ? (
          <SplitPaneLiveEditor
            key={activeNoteId}
            value={content}
            onChange={handleChange}
            onCursorLineChange={setCurrentLineIndex}
            onContextMenu={handleEditorContextMenu}
            onPreviewContextMenu={handleLivePreviewContextMenu}
            mdFilePath={note.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
            onTriggerLinkPopup={handleTriggerLinkPopup}
            onLinkClick={handleLinkClick}
          />
        ) : mode === 'edit' ? (
          <MarkdownEditor
            value={content}
            onChange={handleChange}
            onCursorLineChange={setCurrentLineIndex}
            placeholder="# 标题\n\n内容..."
            onContextMenu={handleEditorContextMenu}
            mdFilePath={note.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
            onTriggerLinkPopup={handleTriggerLinkPopup}
          />
        ) : (
          <div
            className="flex-1 min-h-0 overflow-auto"
            style={{ userSelect: 'text' }}
            onContextMenu={handlePreviewContextMenu}
          >
            <MarkdownPreview content={content} mdFilePath={note.filePath} onLinkClick={handleLinkClick} />
          </div>
        )}
      </div>

      {/* TOC — portaled to root, completely outside scroll/layout flow */}
      {rootRef.current && createPortal(
        <TableOfContents
          content={content}
          maxLevel={tocMaxLevel}
          currentLineIndex={currentLineIndex}
          onHeadingClick={handleHeadingClick}
          onClose={() => { setTocVisible(false) }}
          open={tocVisible}
        />,
        rootRef.current
      )}

      {/* Context Menu Portal */}
      {contextMenuState && createPortal(
        <MarkdownContextMenu
          anchorRect={contextMenuState.anchorRect}
          onClose={() => setContextMenuState(null)}
          mode={contextMenuState.mode}
          text={content}
          selectionStart={contextMenuState.selection?.start ?? 0}
          selectionEnd={contextMenuState.selection?.end ?? 0}
          selectedText={contextMenuState.selection ? content.substring(contextMenuState.selection.start, contextMenuState.selection.end) : ''}
          hasSelection={contextMenuState.selection ? contextMenuState.selection.start !== contextMenuState.selection.end : false}
          onApplyOperation={handleApplyOperation}
          previewContent={content}
          onInsertImage={handleInsertImageFromPicker}
          onInsertLinkRef={() => handleTriggerLinkPopup(textareaEl?.selectionStart ?? 0)}
        />,
        document.body
      )}

      {linkPopupState && createPortal(
        <LinkSuggestionPopup
          anchorRect={linkPopupState.anchorRect}
          onSelect={handleLinkSelect}
          onClose={handleLinkPopupClose}
        />,
        document.body,
      )}

      {editorContextMenu && (
        <ContextMenu
          items={[
            {
              label: '导出 PDF',
              icon: <Download size={13} />,
              onClick: () => {
                setExportOpen(true)
                setEditorContextMenu(null)
              },
            },
          ]}
          anchorRect={editorContextMenu}
          onClose={() => setEditorContextMenu(null)}
        />
      )}
      {exportOpen && <ExportDialog open onClose={() => setExportOpen(false)} onExport={handleExport} />}
    </div>
  )
}
