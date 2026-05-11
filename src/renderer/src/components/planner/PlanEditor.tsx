import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { usePlanStore } from '@/stores/planStore'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import MarkdownPreview from '@/components/common/MarkdownPreview'
import { ArrowLeft, Pencil, Eye } from 'lucide-react'
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
import { imageApi, fs } from '@/lib/ipc'
import LinkSuggestionPopup from '@/components/common/LinkSuggestionPopup'

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
  const [editMode, setEditMode] = useState<'edit' | 'preview'>('edit')
  const [dirty, setDirty] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const contentRef = useRef(content)
  contentRef.current = content
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  const prevImageRefsRef = useRef<Set<string>>(new Set())
  const allTags = useMemo(() => getAllTags(plans), [plans])

  const [contextMenuState, setContextMenuState] = useState<{
    anchorRect: DOMRect
    mode: 'edit' | 'preview'
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

  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    loadPlanContent(planId).then((c) => {
      setContent(c)
      setDirty(false)
    })
  }, [planId, loadPlanContent])

  const doSave = useCallback(async (isAuto: boolean) => {
    if (!plan) return
    await savePlanContent(plan.id, contentRef.current)

    const h1 = extractH1Title(contentRef.current)
    if (h1 && h1 !== plan.title) {
      await updatePlan(plan.id, { title: h1 })
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
        await cleanupOrphanImages(plan.filePath, contentRef.current)
      }
    }
    prevImageRefsRef.current = currentRefs

    setDirty(false)
    showToast(isAuto ? '自动保存成功' : '保存成功')
  }, [plan, savePlanContent, updatePlan, showToast])

  const doSaveRef = useRef(doSave)
  doSaveRef.current = doSave

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

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
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
      mode: 'edit',
      selection: { start: ta.selectionStart, end: ta.selectionEnd },
    })
  }, [])

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
    if (type === 'plan') {
      navPush({ panel: 'planner', subView: 'editor', planId: id })
    } else if (type === 'note') {
      navPush({ panel: 'notes', subView: 'editor', noteId: id })
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

  if (!plan) return null

  const handleChange = useCallback((newContent: string) => {
    setContent(newContent)
    setDirty(true)

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => doSave(true), AUTO_SAVE_DELAY)
  }, [doSave])

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

  return (
    <div ref={rootRef} className="flex flex-col h-full gap-3" style={{ position: 'relative' }}>
      <ToastContainer />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => navPush({ panel: 'planner', subView: 'list' })}
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
          {dirty && editMode === 'edit' && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-orange)', flexShrink: 0 }} />
          )}
        </div>

        {/* Edit / Preview toggle */}
        <div
          className="flex gap-0.5"
          style={{
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            padding: 2,
          }}
        >
          {([['edit', Pencil], ['preview', Eye]] as const).map(([mode, Icon]) => (
            <motion.button
              key={mode}
              onClick={() => setEditMode(mode)}
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
      </div>

      {/* Tags */}
      <TagInput
        tags={plan.tags ?? []}
        allTags={allTags}
        onUpdateTags={(tags) => updatePlanTags(plan.id, tags)}
      />

      {/* Content */}
      <div ref={editorRef} className="flex-1 min-h-0" style={{ overflow: editMode === 'preview' ? 'auto' : 'hidden' }}>
        {editMode === 'edit' ? (
          <MarkdownEditor
            value={content}
            onChange={handleChange}
            placeholder="# 计划内容\n\n- [ ] 待办项 1\n- [ ] 待办项 2"
            onContextMenu={handleEditorContextMenu}
            mdFilePath={plan.filePath}
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
    </div>
  )
}
