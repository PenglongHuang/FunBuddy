import { useState, useMemo, useCallback, useEffect } from 'react'
import { usePlanStore } from '@/stores/planStore'
import { Plus, Trash2, CheckSquare, Square, Calendar, CalendarDays, CalendarRange, MoreVertical } from 'lucide-react'
import TagFilterBar from '@/components/common/TagFilterBar'
import { getTagsWithCounts } from '@/lib/tag-utils'
import { useNoteStore } from '@/stores/noteStore'
import { motion, AnimatePresence } from 'motion/react'
import PlanCreateDialog from './PlanCreateDialog'
import PlanContextMenu from './PlanContextMenu'
import { usePetStore } from '@/stores/petStore'
import { useTimerStore } from '@/stores/timerStore'
import type { PlanType, Plan } from '@/types/plan'

type TabKey = 'all' | PlanType

const TABS: Array<{ key: TabKey; label: string; color: string }> = [
  { key: 'all', label: '全部', color: 'var(--text-quaternary)' },
  { key: 'daily', label: '日计划', color: '#60a5fa' },
  { key: 'weekly', label: '周计划', color: '#c084fc' },
  { key: 'monthly', label: '月计划', color: '#fbbf24' },
]

const TYPE_BADGE: Record<string, { bg: string; label: string }> = {
  daily: { bg: 'rgba(96,165,250,0.12)', label: '日' },
  weekly: { bg: 'rgba(192,132,252,0.12)', label: '周' },
  monthly: { bg: 'rgba(251,191,36,0.12)', label: '月' },
  neutral: { bg: 'rgba(148,163,184,0.12)', label: '其他' },
}

function planIcon(plan: Plan) {
  const size = 14
  const color = plan.color
  switch (plan.planType) {
    case 'weekly':
      return <CalendarRange size={size} color={color} />
    case 'monthly':
      return <CalendarDays size={size} color={color} />
    default:
      return <Calendar size={size} color={color} />
  }
}

export default function PlanList() {
  const plans = usePlanStore((s) => s.plans)
  const createPlan = usePlanStore((s) => s.createPlan)
  const deletePlan = usePlanStore((s) => s.deletePlan)
  const deletePlans = usePlanStore((s) => s.deletePlans)
  const setActivePlan = usePlanStore((s) => s.setActivePlan)
  const activePlanId = usePlanStore((s) => s.activePlanId)
  const renamePlanTag = usePlanStore((s) => s.renameTag)
  const deletePlanTag = usePlanStore((s) => s.deleteTag)
  const renameNoteTag = useNoteStore((s) => s.renameTag)
  const deleteNoteTag = useNoteStore((s) => s.deleteTag)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single'; id: string } | { type: 'batch' } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ planId: string; rect: DOMRect } | null>(null)
  const setActivePanel = usePetStore((s) => s.setActivePanel)
  const setWindowMode = usePetStore((s) => s.setWindowMode)

  const filteredPlans = useMemo(() => {
    let result = plans
    if (activeTab !== 'all') result = result.filter((p) => (p.planType || 'daily') === activeTab)
    if (activeFilterTag !== null) result = result.filter((p) => (p.tags ?? []).includes(activeFilterTag))
    return result
  }, [plans, activeTab, activeFilterTag])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: plans.length }
    for (const p of plans) {
      const t = p.planType || 'daily'
      c[t] = (c[t] || 0) + 1
    }
    return c
  }, [plans])

  const tagFilterItems = useMemo(() => getTagsWithCounts(plans), [plans])

  const handleRenameTag = useCallback(async (oldName: string, newName: string) => {
    await Promise.all([renamePlanTag(oldName, newName), renameNoteTag(oldName, newName)])
  }, [renamePlanTag, renameNoteTag])

  const handleDeleteTag = useCallback(async (tagName: string) => {
    await Promise.all([deletePlanTag(tagName), deleteNoteTag(tagName)])
  }, [deletePlanTag, deleteNoteTag])

  useEffect(() => {
    if (activeFilterTag !== null) {
      const remaining = plans.filter((p) => (p.tags ?? []).includes(activeFilterTag))
      if (remaining.length === 0) setActiveFilterTag(null)
    }
  }, [plans, activeFilterTag])

  const visibleIds = useMemo(() => new Set(filteredPlans.map((p) => p.id)), [filteredPlans])
  const allSelected = filteredPlans.length > 0 && filteredPlans.every((p) => selectedIds.has(p.id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of visibleIds) next.delete(id)
        return next
      })
    } else {
      setSelectedIds((prev) => new Set([...prev, ...visibleIds]))
    }
  }

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return
    setDeleteTarget({ type: 'batch' })
  }

  const exitEditMode = () => {
    setEditMode(false)
    setSelectedIds(new Set())
  }

  const handleCreateConfirm = async (title: string, startDate: string, endDate: string | null, planType: PlanType) => {
    const plan = await createPlan(title, startDate, endDate, planType)
    setActivePlan(plan.id)
    setShowCreateDialog(false)
  }

  const handleSingleDelete = (id: string) => {
    setDeleteTarget({ type: 'single', id })
  }

  const handleStartFocusFromPlan = (planId: string) => {
    setActivePanel('timer')
    setWindowMode('expanded')
    useTimerStore.getState().startWithPlan(planId)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'single') {
      await deletePlan(deleteTarget.id)
      if (activePlanId === deleteTarget.id) setActivePlan(null)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(deleteTarget.id)
        return next
      })
    } else {
      await deletePlans(Array.from(selectedIds))
      if (activePlanId && selectedIds.has(activePlanId)) setActivePlan(null)
      setSelectedIds(new Set())
      setEditMode(false)
    }
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        {editMode ? (
          <>
            <button
              onClick={toggleSelectAll}
              className="hover-blue-bg"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 'var(--radius-sm)',
                transition: 'background 0.15s ease',
              }}
            >
              {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
              <span style={{ fontSize: 12, fontWeight: 500 }}>全选</span>
            </button>
            <button
              onClick={exitEditMode}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 500,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          </>
        ) : (
          <>
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-tertiary)' }}>
              {filteredPlans.length} 个计划
            </span>
            <div className="flex items-center gap-1">
              {plans.length > 0 && (
                <button
                  onClick={() => setEditMode(true)}
                  className="hover-blue-lift"
                  style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'color 0.15s ease, background 0.15s ease',
                  }}
                >
                  管理
                </button>
              )}
              <motion.button
                onClick={() => setShowCreateDialog(true)}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.04 }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 2px 8px rgba(10,132,255,0.25)',
                }}
              >
                <Plus size={13} strokeWidth={2.5} />
                新建
              </motion.button>
            </div>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div
        className="flex shrink-0"
        style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-full)',
          padding: 2,
          gap: 1,
        }}
      >
        {TABS.map(({ key, label, color }) => {
          const count = counts[key] || 0
          if (key !== 'all' && count === 0) return null
          const isActive = activeTab === key
          return (
            <motion.button
              key={key}
              onClick={() => setActiveTab(key)}
              whileTap={{ scale: 0.95 }}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 'var(--radius-full)',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'var(--bg-base)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.2s ease, background 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {key !== 'all' && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
              )}
              {label}
            </motion.button>
          )
        })}
      </div>

      {/* Tag filter */}
      {tagFilterItems.length > 0 && (
        <TagFilterBar
          tags={tagFilterItems}
          activeTag={activeFilterTag}
          totalItems={plans.length}
          onSelect={setActiveFilterTag}
          onRenameTag={handleRenameTag}
          onDeleteTag={handleDeleteTag}
        />
      )}

      {/* Plan cards */}
      <div className="flex flex-col" style={{ gap: 4 }}>
        {filteredPlans.map((plan) => {
          const badge = TYPE_BADGE[plan.planType || 'daily']
          const isSelected = selectedIds.has(plan.id)
          const isActive = !editMode && activePlanId === plan.id
          return (
            <motion.div
              key={plan.id}
              onClick={() => {
                if (editMode) toggleSelect(plan.id)
                else setActivePlan(plan.id)
              }}
              whileTap={{ scale: 0.98 }}
              className="group"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: isActive
                  ? 'rgba(255,255,255,0.06)'
                  : isSelected
                    ? 'rgba(10,132,255,0.06)'
                    : 'var(--bg-secondary)',
                border: isActive
                  ? '0.5px solid rgba(255,255,255,0.10)'
                  : isSelected
                    ? '0.5px solid rgba(10,132,255,0.20)'
                    : '0.5px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                transition: 'background 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!editMode && !isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                }
              }}
              onMouseLeave={(e) => {
                if (!editMode && !isActive) {
                  e.currentTarget.style.background = 'var(--bg-secondary)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'
                }
              }}
            >
              {/* Left: checkbox or icon */}
              {editMode ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(plan.id) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: isSelected ? 'var(--accent-blue)' : 'var(--text-quaternary)',
                    flexShrink: 0,
                    transition: 'color 0.15s ease',
                  }}
                >
                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              ) : (
                <div style={{ flexShrink: 0, color: plan.color, display: 'flex' }}>
                  {planIcon(plan)}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="truncate"
                    style={{
                      font: 'var(--text-caption-1)',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {plan.title}
                  </span>
                  {badge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-full)',
                        background: badge.bg,
                        color: plan.color,
                        flexShrink: 0,
                        letterSpacing: 0.3,
                      }}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
                {(plan.tags ?? []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' as const }}>
                    {(plan.tags ?? []).slice(0, 3).map((tag) => (
                      <span key={tag} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 6,
                        color: '#8ab4f8',
                        border: '1px solid rgba(138,180,248,0.2)',
                      }}>
                        <svg width="8" height="8" viewBox="0 0 16 16">
                          <circle cx="8" cy="8" r="3" fill="#8ab4f8" />
                        </svg>
                        {tag}
                      </span>
                    ))}
                    {(plan.tags ?? []).length > 3 && (
                      <span style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>
                        +{(plan.tags ?? []).length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* More menu */}
              {!editMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    setContextMenu({ planId: plan.id, rect })
                  }}
                  style={{
                    opacity: 0, background: 'transparent', border: 'none',
                    color: 'var(--text-quaternary)', cursor: 'pointer', padding: 4,
                    borderRadius: 'var(--radius-sm)',
                    transition: 'opacity 0.15s ease, color 0.15s ease',
                    flexShrink: 0,
                  }}
                  className="group-hover:opacity-100"
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-quaternary)' }}
                >
                  <MoreVertical size={14} />
                </button>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Empty state */}
      <AnimatePresence mode="wait">
        {filteredPlans.length === 0 && !editMode && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              textAlign: 'center',
              padding: '32px 0 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Calendar size={28} style={{ color: 'var(--text-quaternary)', opacity: 0.4 }} strokeWidth={1.2} />
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-quaternary)' }}>
              {activeTab === 'all' ? '暂无计划' : '该类型暂无计划'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch delete action bar */}
      <AnimatePresence>
        {editMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              border: '0.5px solid rgba(255,255,255,0.06)',
            }}
          >
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              已选 {selectedIds.size} 项
            </span>
            <motion.button
              onClick={handleBatchDelete}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: '5px 16px',
                borderRadius: 'var(--radius-full)',
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--accent-pink)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255,55,95,0.20)',
              }}
            >
              删除
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create dialog */}
      {showCreateDialog && (
        <PlanCreateDialog
          onConfirm={handleCreateConfirm}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 280,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-xl)',
                padding: 20,
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}
            >
              <span style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                确认删除
              </span>
              <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-secondary)', display: 'block', marginBottom: 20 }}>
                {deleteTarget.type === 'batch'
                  ? `确定要删除选中的 ${selectedIds.size} 个计划吗？此操作不可撤销。`
                  : '确定要删除这个计划吗？此操作不可撤销。'}
              </span>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  style={{
                    padding: '0 16px',
                    height: 34,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 500,
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    padding: '0 20px',
                    height: 34,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 600,
                    background: 'var(--accent-pink)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {contextMenu && (
        <PlanContextMenu
          planTitle={plans.find((p) => p.id === contextMenu.planId)?.title ?? ''}
          onEdit={() => setActivePlan(contextMenu.planId)}
          onDelete={() => handleSingleDelete(contextMenu.planId)}
          onStartFocus={() => handleStartFocusFromPlan(contextMenu.planId)}
          onClose={() => setContextMenu(null)}
          anchorRect={contextMenu.rect}
        />
      )}
    </div>
  )
}
