import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { usePlanStore } from '@/stores/planStore'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import MarkdownPreview from '@/components/common/MarkdownPreview'
import SplitPaneLiveEditor from '@/components/common/SplitPaneLiveEditor'
import { ArrowLeft, Pencil, Eye, Zap, MoreVertical, Download, List } from 'lucide-react'
import { motion } from 'motion/react'
import { extractH1Title } from '@/utils/markdown'
import { useToast } from '@/components/common/Toast'
import TagInput from '@/components/common/TagInput'
import { getAllTags } from '@/lib/tag-utils'
import MarkdownContextMenu from '@/components/ui/MarkdownContextMenu'
import useTextSelection from '@/hooks/useTextSelection'
import { applyOperationToTextarea, createInsertImageWithPath, createInsertLinkRef } from '@/lib/markdown-operations'
import { type LinkSearchResult } from '@/lib/link-resolver'
import { useNavigationStore } from '@/stores/navigationStore'
import { imageApi } from '@/lib/ipc'
import LinkSuggestionPopup from '@/components/common/LinkSuggestionPopup'
import ContextMenu from '@/components/ui/ContextMenu'
import ExportDialog from '@/components/common/ExportDialog'
import { buildExportHtml, type ExportMode } from '@/lib/export-pdf'
import { pdfExport } from '@/lib/ipc'
import { useToastStore } from '@/stores/toastStore'
import TableOfContents from '@/components/common/TableOfContents'
import { extractHeadings } from '@/lib/toc-extract'

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

interface PlanEditorProps {
  planId: string
}

export default function PlanEditor({ planId }: PlanEditorProps) {
  const plan = usePlanStore((s) => s.plans.find((p) => p.id === planId))
  const loadPlanContent = usePlanStore((s) => s.loadPlanContent)
  const savePlanContent = usePlanStore((s) => s.savePlanContent)
  const updatePlan = usePlanStore((s) => s.updatePlan)
  const updatePlanTags = usePlanStore((s) => s.updatePlanTags)
  const plans = usePlanStore((s) => s.plans)
  const navPush = useNavigationStore((s) => s.push)

  const [content, setContent] = useState('')
  const [editMode, setEditMode] = useState<'live' | 'edit' | 'preview'>(
    () => usePlanStore.getState().editorMode
  )
  const [dirty, setDirty] = useState(false)
  const contentRef = useRef(content)
  contentRef.current = content
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  const allTags = useMemo(() => getAllTags(plans), [plans])

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
  const editorRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [editorContextMenu, setEditorContextMenu] = useState<DOMRect | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const [tocVisible, setTocVisible] = useState(false)
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(0)
  const toggleTocRef = useRef<() => void>(() => {})

  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    loadPlanContent(planId).then((c) => {
      setContent(c)
      setDirty(false)
    })
  }, [planId, loadPlanContent])

  const doSave = useCallback(async () => {
    if (!plan) return
    await savePlanContent(plan.id, contentRef.current)

    const h1 = extractH1Title(contentRef.current)
    if (h1 && h1 !== plan.title) {
      await updatePlan(plan.id, { title: h1 })
    }

    setDirty(false)
    showToast('保存成功')
  }, [plan, savePlanContent, updatePlan, showToast])

  const doSaveRef = useRef(doSave)
  doSaveRef.current = doSave

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        doSaveRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggleToc = useCallback(() => { setTocVisible((v) => !v) }, [])
  toggleTocRef.current = toggleToc

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

  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        const store = usePlanStore.getState()
        const currentPlan = store.plans.find((p) => p.id === planId)
        if (currentPlan) {
          store.savePlanContent(planId, contentRef.current)
          const h1 = extractH1Title(contentRef.current)
          if (h1 && h1 !== currentPlan.title) {
            store.updatePlan(planId, { title: h1 })
          }
        }
      }
    }
  }, [planId])

  useEffect(() => {
    if (editorRef.current) {
      const ta = editorRef.current.querySelector('textarea') as HTMLTextAreaElement | null
      setTextareaEl(ta)
    }
  }, [planId, editMode])

  const handleEditorContextMenu = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const ta = e.currentTarget
    setContextMenuState({
      anchorRect: DOMRect.fromRect({ width: 0, height: 0, x: e.clientX, y: e.clientY }),
      mode: editMode === 'live' ? 'live' : 'edit',
      selection: { start: ta.selectionStart, end: ta.selectionEnd },
    })
  }, [editMode])

  const handlePreviewContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuState({
      anchorRect: DOMRect.fromRect({ width: 0, height: 0, x: e.clientX, y: e.clientY }),
      mode: 'preview',
      selection: null,
    })
  }, [])

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
    if (type === 'deleted') {
      showToast('链接指向的内容已被删除')
      return
    }
    if (type === 'plan') {
      navPush({ panel: 'planner', subView: 'editor', planId: id })
    } else if (type === 'note') {
      navPush({ panel: 'notes', subView: 'editor', noteId: id })
    }
  }, [navPush, showToast])

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

  if (!plan) return null

  const handleExport = async (mode: ExportMode) => {
    if (!plan) return
    try {
      const loadedContent = await loadPlanContent(planId)
      const html = await buildExportHtml({
        content: loadedContent || '',
        mdFilePath: plan.filePath,
        title: plan.title,
        mode,
        fileName: `${plan.title}.pdf`,
        meta: {
          tags: plan.tags,
          createdAt: plan.createdAt?.slice(0, 10),
          planType: plan.planType,
          startDate: plan.startDate,
          endDate: plan.endDate,
        },
      })
      const result = await pdfExport.generate(html, `${plan.title}.pdf`)
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

  const handleChange = useCallback((newContent: string) => {
    setContent(newContent)
    setDirty(true)
  }, [])

  const handleApplyOperation = useCallback((newText: string, cursorStart: number, cursorEnd: number) => {
    if (!textareaEl) return
    applyOperationToTextarea(textareaEl, content, newText, cursorStart, cursorEnd)
    setContextMenuState(null)
  }, [content, textareaEl])

  const handleInsertImageFromPicker = useCallback(async () => {
    if (!plan || !textareaEl) return
    try {
      const result = await imageApi.pickAndSave(plan.filePath)
      if (!result) return
      const op = createInsertImageWithPath(result.relativePath, result.fileName)
      const res = op(content, textareaEl.selectionStart, textareaEl.selectionEnd)
      applyOperationToTextarea(textareaEl, content, res.text, res.start, res.end)
    } catch {
      showToast('保存图片失败')
    }
  }, [plan, content, textareaEl, showToast])

  const handleHeadingClick = useCallback((lineIndex: number) => {
    setCurrentLineIndex(lineIndex)
    if (!editorRef.current) return

    if (editMode === 'edit' || editMode === 'live') {
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
    const headings = extractHeadings(content, 3)
    const targetIdx = headings.findIndex(h => h.lineIndex === lineIndex)
    if (targetIdx !== -1) {
      const headingEls = editorRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')
      if (headingEls.length > targetIdx) {
        scrollToElement(headingEls[targetIdx] as HTMLElement)
      }
    }
  }, [editMode, content])

  return (
    <div ref={rootRef} className="flex flex-col h-full gap-3" style={{ position: 'relative', paddingTop: 8 }}>
      <ToastContainer />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => {
            if (tocVisible) { setTocVisible(false) }
            usePlanStore.getState().deactivateTab()
            navPush({ panel: 'planner', subView: 'list' })
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
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: plan.color, flexShrink: 0 }} />
          <span className="truncate" style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600 }}>
            {plan.title}
          </span>
          {dirty && editMode !== 'preview' && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-orange)', flexShrink: 0 }} />
          )}
        </div>

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
            flexShrink: 0,
          }}
        >
          <List size={12} />
        </motion.button>

        {/* Edit / Preview toggle */}
        <div
          className="flex gap-0.5"
          style={{
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            padding: 2,
          }}
        >
          {([
              ['edit', Pencil],
              ['live', Zap],
              ['preview', Eye],
            ] as const).map(([mode, Icon]) => (
            <motion.button
              key={mode}
              onClick={() => {
                setEditMode(mode)
                usePlanStore.getState().setEditorMode(mode)
              }}
              whileTap={{ scale: 0.9 }}
              style={{
                width: 28, height: 24, borderRadius: 5,
                background: editMode === mode ? 'var(--accent-blue)' : 'transparent',
                color: editMode === mode ? '#fff' : 'var(--text-quaternary)',
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
          onClick={(e) => { e.stopPropagation(); setEditorContextMenu(e.currentTarget.getBoundingClientRect()) }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-quaternary)', padding: 4, borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Tags */}
      <TagInput
        tags={plan.tags ?? []}
        allTags={allTags}
        onUpdateTags={(tags) => updatePlanTags(plan.id, tags)}
      />

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

      {/* Content */}
      <div ref={editorRef} className="flex-1 min-h-0" style={{ overflow: editMode === 'preview' ? 'auto' : 'hidden' }}>
        {editMode === 'live' ? (
          <SplitPaneLiveEditor
            key={planId}
            value={content}
            onChange={handleChange}
            onCursorLineChange={setCurrentLineIndex}
            onContextMenu={handleEditorContextMenu}
            onPreviewContextMenu={handlePreviewContextMenu}
            mdFilePath={plan.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
            onTriggerLinkPopup={handleTriggerLinkPopup}
            onLinkClick={handleLinkClick}
          />
        ) : editMode === 'edit' ? (
          <MarkdownEditor
            value={content}
            onChange={handleChange}
            placeholder="# 计划内容\n\n- [ ] 待办项 1\n- [ ] 待办项 2"
            onContextMenu={handleEditorContextMenu}
            mdFilePath={plan.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
            onTriggerLinkPopup={handleTriggerLinkPopup}
            onCursorLineChange={setCurrentLineIndex}
          />
        ) : (
          <div
            className="flex-1 min-h-0 overflow-auto"
            style={{ userSelect: 'text' }}
            onContextMenu={handlePreviewContextMenu}
          >
            <MarkdownPreview content={content} mdFilePath={plan.filePath} onLinkClick={handleLinkClick} />
          </div>
        )}
      </div>

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

      {rootRef.current && createPortal(
        <TableOfContents
          content={content}
          maxLevel={3}
          currentLineIndex={currentLineIndex}
          onHeadingClick={handleHeadingClick}
          onClose={() => setTocVisible(false)}
          open={tocVisible}
        />,
        rootRef.current
      )}
    </div>
  )
}
