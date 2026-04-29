import { useEffect, useState, useRef, useCallback } from 'react'
import { usePlanStore } from '@/stores/planStore'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import MarkdownPreview from '@/components/common/MarkdownPreview'
import { ArrowLeft, Pencil, Eye } from 'lucide-react'
import { motion } from 'motion/react'
import { extractH1Title } from '@/utils/markdown'
import { useToast } from '@/components/common/Toast'

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

  const [content, setContent] = useState('')
  const [editMode, setEditMode] = useState<'edit' | 'preview'>('edit')
  const [dirty, setDirty] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const contentRef = useRef(content)
  contentRef.current = content

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
    }
  }, [])

  if (!plan) return null

  const handleChange = (newContent: string) => {
    setContent(newContent)
    setDirty(true)

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => doSave(true), AUTO_SAVE_DELAY)
  }

  return (
    <div className="flex flex-col h-full gap-3" style={{ position: 'relative' }}>
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

      {/* Date pill */}
      <span
        style={{
          font: 'var(--text-caption-2)',
          color: 'var(--text-quaternary)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: plan.color }} />
        {plan.startDate}{plan.endDate && plan.endDate !== plan.startDate ? ` → ${plan.endDate}` : ''}
      </span>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {editMode === 'edit' ? (
          <MarkdownEditor value={content} onChange={handleChange} placeholder="# 计划内容\n\n- [ ] 待办项 1\n- [ ] 待办项 2" />
        ) : (
          <MarkdownPreview content={content} />
        )}
      </div>
    </div>
  )
}
