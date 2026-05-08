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
import { applyOperationToTextarea } from '@/lib/markdown-operations'

const AUTO_SAVE_DELAY = 3000

interface PlanEditorProps {
  planId: string
}

export default function PlanEditor({ planId }: PlanEditorProps) {
  const plan = usePlanStore((s) => s.plans.find((p) => p.id === planId))
  const loadPlanContent = usePlanStore((s) => s.loadPlanContent)
  const savePlanContent = usePlanStore((s) => s.savePlanContent)
  const updatePlan = usePlanStore((s) => s.updatePlan)
  const setActivePlan = usePlanStore((s) => s.setActivePlan)
  const updatePlanTags = usePlanStore((s) => s.updatePlanTags)
  const plans = usePlanStore((s) => s.plans)

  const [content, setContent] = useState('')
  const [editMode, setEditMode] = useState<'edit' | 'preview'>('edit')
  const [dirty, setDirty] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const contentRef = useRef(content)
  contentRef.current = content
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  const allTags = useMemo(() => getAllTags(plans), [plans])

  const [contextMenuState, setContextMenuState] = useState<{
    anchorRect: DOMRect
    mode: 'edit' | 'preview'
    selection: { start: number; end: number } | null
  } | null>(null)
  const [textareaEl, setTextareaEl] = useState<HTMLTextAreaElement | null>(null)
  const selection = useTextSelection(textareaEl)
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

    setDirty(false)
    showToast(isAuto ? '自动保存成功' : '保存成功')
  }, [plan, savePlanContent, updatePlan, showToast])

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

  return (
    <div ref={rootRef} className="flex flex-col h-full gap-3" style={{ position: 'relative' }}>
      <ToastContainer />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => setActivePlan(null)}
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
          />
        ) : (
          <div
            className="flex-1 min-h-0 overflow-auto"
            style={{ userSelect: 'text' }}
            onContextMenu={handlePreviewContextMenu}
          >
            <MarkdownPreview content={content} />
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
        />,
        document.body
      )}
    </div>
  )
}
