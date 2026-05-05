import { useState, useMemo, useCallback, useEffect } from 'react'
import { usePlanStore } from '@/stores/planStore'
import { Plus, Trash2, CheckSquare, Square, Calendar, CalendarDays, CalendarRange, Play, Timer, FileText, LayoutGrid, Grid3X3, Clock, ArrowDownAZ } from 'lucide-react'
import TagFilterBar from '@/components/common/TagFilterBar'
import SortDropdown from '@/components/common/ListToolbar'
import PlanTypeFilter from '@/components/common/PlanTypeFilter'

type ViewMode = 'card' | 'compact'
import { formatFocusTime } from '@/lib/format-time'
import { getTagsWithCounts } from '@/lib/tag-utils'
import { useNoteStore } from '@/stores/noteStore'
import { motion, AnimatePresence } from 'motion/react'
import PlanCreateDialog from './PlanCreateDialog'
import PlanEditDialog from './PlanEditDialog'
import { Button, ContextMenu, ConfirmDialog, TagBadge, MoreButton } from '@/components/ui'
import { usePetStore } from '@/stores/petStore'
import { useTimerStore } from '@/stores/timerStore'
import { useToastStore } from '@/stores/toastStore'
import type { PlanType, Plan } from '@/types/plan'

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

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateRange(plan: Plan): string {
  const s = formatShortDate(plan.startDate)
  const e = plan.endDate ? formatShortDate(plan.endDate) : null
  return e && e !== s ? `${s} - ${e}` : s
}

function formatDateRangeFull(plan: Plan): string {
  const s = new Date(plan.startDate).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  if (!plan.endDate) return s
  const e = new Date(plan.endDate).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  return e !== s ? `${s} - ${e}` : s
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
  const sortBy = usePlanStore((s) => s.sortBy)
  const viewMode = usePlanStore((s) => s.viewMode)
  const setSortBy = usePlanStore((s) => s.setSortBy)
  const setViewMode = usePlanStore((s) => s.setViewMode)
  const getPlanFocusMinutes = useTimerStore((s) => s.getPlanFocusMinutes)
  const renameNoteTag = useNoteStore((s) => s.renameTag)
  const deleteNoteTag = useNoteStore((s) => s.deleteTag)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null)
  const [planTypeFilter, setPlanTypeFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all')
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single'; id: string } | { type: 'batch' } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ planId: string; rect: DOMRect } | null>(null)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const updatePlan = usePlanStore((s) => s.updatePlan)
  const setActivePanel = usePetStore((s) => s.setActivePanel)
  const setWindowMode = usePetStore((s) => s.setWindowMode)

  const filteredPlans = useMemo(() => {
    let result = plans
    if (planTypeFilter !== 'all') {
      result = result.filter((p) => p.planType === planTypeFilter)
    }
    if (activeFilterTag !== null) {
      result = result.filter((p) => (p.tags ?? []).includes(activeFilterTag))
    }
    return result
  }, [plans, planTypeFilter, activeFilterTag])

  const sortedPlans = useMemo(() => {
    const sorted = [...filteredPlans]
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
        break
      case 'planDate':
        sorted.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        break
      default: // 'time'
        sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
    return sorted
  }, [filteredPlans, sortBy])

  const tagFilterItems = useMemo(() => getTagsWithCounts(filteredPlans), [filteredPlans])

  const handleRenameTag = useCallback(async (oldName: string, newName: string) => {
    await Promise.all([renamePlanTag(oldName, newName), renameNoteTag(oldName, newName)])
  }, [renamePlanTag, renameNoteTag])

  const handleDeleteTag = useCallback(async (tagName: string) => {
    await Promise.all([deletePlanTag(tagName), deleteNoteTag(tagName)])
  }, [deletePlanTag, deleteNoteTag])

  useEffect(() => {
    if (activeFilterTag !== null) {
      const remaining = filteredPlans.filter((p) => (p.tags ?? []).includes(activeFilterTag))
      if (remaining.length === 0) setActiveFilterTag(null)
    }
  }, [filteredPlans, activeFilterTag])

  useEffect(() => {
    if (planTypeFilter !== 'all') {
      const remaining = plans.filter((p) => p.planType === planTypeFilter)
      if (remaining.length === 0) setPlanTypeFilter('all')
    }
  }, [plans, planTypeFilter])

  const visibleIds = useMemo(() => new Set(sortedPlans.map((p) => p.id)), [sortedPlans])
  const allSelected = sortedPlans.length > 0 && sortedPlans.every((p) => selectedIds.has(p.id))

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
    useToastStore.getState().show('新建计划成功')
  }

  const handleSingleDelete = (id: string) => {
    setDeleteTarget({ type: 'single', id })
  }

  const handleStartFocusFromPlan = (planId: string) => {
    setActivePanel('timer')
    setWindowMode('expanded')
    useTimerStore.setState({ pendingStartPlanId: planId })
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

  const gridStyle = viewMode === 'compact'
    ? { gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, alignContent: 'start' as const }
    : { gridTemplateColumns: '1fr', gap: 8, alignContent: 'start' as const }

  return (
    <div className="flex flex-col h-full" style={{ gap: 6, position: 'relative' }}>
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
            <Button variant="secondary" onClick={exitEditMode}>取消</Button>
          </>
        ) : (
          <>
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-tertiary)' }}>
              {sortedPlans.length} 个计划
            </span>
            <div className="flex items-center gap-1">
              {plans.length > 0 && (
                <Button variant="ghost" onClick={() => setEditMode(true)}>管理</Button>
              )}
              <Button
                variant="primary"
                icon={<Plus size={13} strokeWidth={2.5} />}
                motionProps={{ whileTap: { scale: 0.92 }, whileHover: { scale: 1.04 } }}
                onClick={() => setShowCreateDialog(true)}
              >
                新建
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Plan type filter */}
      {plans.length > 0 && !editMode && (
        <PlanTypeFilter value={planTypeFilter} onChange={setPlanTypeFilter} />
      )}

      {/* Merged row: tag filter + sort + view toggle */}
      {tagFilterItems.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TagFilterBar
              tags={tagFilterItems}
              activeTag={activeFilterTag}
              totalItems={filteredPlans.length}
              onSelect={setActiveFilterTag}
              onRenameTag={handleRenameTag}
              onDeleteTag={handleDeleteTag}
            />
          </div>
          {!editMode && (
            <>
              <SortDropdown
                sortOptions={[
                  { value: 'time', label: '时间', icon: <Clock size={12} /> },
                  { value: 'name', label: '名称', icon: <ArrowDownAZ size={12} /> },
                  { value: 'planDate', label: '计划日期', icon: <Calendar size={12} /> },
                ]}
                currentSort={sortBy}
                onSortChange={(v) => setSortBy(v as 'time' | 'name' | 'planDate')}
              />
              <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ display: 'flex', gap: 2 }}>
                <button onClick={() => setViewMode('card')} style={{
                  padding: '3px 5px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: viewMode === 'card' ? 'var(--accent-blue)' : 'transparent',
                  color: viewMode === 'card' ? '#fff' : 'var(--text-quaternary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}><LayoutGrid size={11} /></button>
                <button onClick={() => setViewMode('compact')} style={{
                  padding: '3px 5px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: viewMode === 'compact' ? 'var(--accent-blue)' : 'transparent',
                  color: viewMode === 'compact' ? '#fff' : 'var(--text-quaternary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}><Grid3X3 size={11} /></button>
              </div>
            </>
          )}
        </div>
      ) : !editMode && plans.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
          <SortDropdown
            sortOptions={[
              { value: 'time', label: '时间', icon: <Clock size={12} /> },
              { value: 'name', label: '名称', icon: <ArrowDownAZ size={12} /> },
              { value: 'planDate', label: '计划日期', icon: <Calendar size={12} /> },
            ]}
            currentSort={sortBy}
            onSortChange={(v) => setSortBy(v as 'time' | 'name' | 'planDate')}
          />
          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => setViewMode('card')} style={{
              padding: '3px 5px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: viewMode === 'card' ? 'var(--accent-blue)' : 'transparent',
              color: viewMode === 'card' ? '#fff' : 'var(--text-quaternary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}><LayoutGrid size={11} /></button>
            <button onClick={() => setViewMode('compact')} style={{
              padding: '3px 5px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: viewMode === 'compact' ? 'var(--accent-blue)' : 'transparent',
              color: viewMode === 'compact' ? '#fff' : 'var(--text-quaternary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}><Grid3X3 size={11} /></button>
          </div>
        </div>
      ) : null}

      {/* Plan cards + empty state */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ display: 'grid', ...gridStyle }}>
        {sortedPlans.map((plan) => {
          const focusMin = getPlanFocusMinutes(plan.id)
          const isSelected = selectedIds.has(plan.id)
          const isActive = !editMode && activePlanId === plan.id

          // --- Card view ---
          if (viewMode === 'card') {
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
                  background: isActive ? 'rgba(255,255,255,0.06)' : 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  border: isSelected ? '0.5px solid rgba(10,132,255,0.20)' : isActive ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(255,255,255,0.04)',
                  borderLeft: `3px solid ${plan.color}`,
                  cursor: 'pointer',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!editMode && !isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!editMode && !isActive) {
                    e.currentTarget.style.background = 'var(--bg-secondary)'
                  }
                }}
              >
                {/* Edit mode checkbox overlay */}
                {editMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(plan.id) }}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: isSelected ? 'var(--accent-blue)' : 'var(--text-quaternary)',
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                )}

                {/* Icon + title row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  {planIcon(plan)}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{plan.title}</span>
                </div>

                {/* Date + focus time row */}
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  <span>🗓 {formatDateRangeFull(plan)}</span>
                  <span style={{ color: focusMin > 0 ? 'var(--accent-teal)' : 'var(--text-quaternary)' }}>⏱ {formatFocusTime(focusMin)}</span>
                </div>

                {/* Tags */}
                {(plan.tags ?? []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                    {(plan.tags ?? []).slice(0, 3).map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                    {(plan.tags ?? []).length > 3 && (
                      <span style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>
                        +{(plan.tags ?? []).length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions on hover (non-edit mode) */}
                {!editMode && (
                  <div className="flex items-center opacity-0 group-hover:opacity-100" style={{
                    position: 'absolute', bottom: 8, right: 8,
                    transition: 'opacity 0.15s ease',
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartFocusFromPlan(plan.id)
                      }}
                      style={{
                        background: 'transparent', border: 'none',
                        color: '#0A84FF', cursor: 'pointer', padding: 4,
                        borderRadius: 'var(--radius-sm)',
                        transition: 'transform 0.15s ease',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                    <MoreButton onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      setContextMenu({ planId: plan.id, rect })
                    }} />
                  </div>
                )}
              </motion.div>
            )
          }

          // --- Compact view ---
          return (
            <motion.div
              key={plan.id}
              onClick={() => {
                if (editMode) toggleSelect(plan.id)
                else setActivePlan(plan.id)
              }}
              whileTap={{ scale: 0.98 }}
              style={{
                background: isSelected ? 'rgba(10,132,255,0.06)' : isActive ? 'rgba(255,255,255,0.06)' : 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: 8,
                textAlign: 'center' as const,
                borderTop: `2px solid ${plan.color}`,
                cursor: 'pointer',
                borderLeft: isSelected ? '0.5px solid rgba(10,132,255,0.20)' : undefined,
              }}
              onMouseEnter={(e) => {
                if (!editMode && !isActive && !isSelected) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (!editMode && !isActive && !isSelected) {
                  e.currentTarget.style.background = 'var(--bg-secondary)'
                }
              }}
            >
              {editMode ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(plan.id) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: isSelected ? 'var(--accent-blue)' : 'var(--text-quaternary)',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', color: plan.color }}>
                  {planIcon(plan)}
                </div>
              )}

              <span style={{ fontSize: 10, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {plan.title}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-quaternary)', marginTop: 2, display: 'block' }}>
                {formatDateRange(plan)}
              </span>
            </motion.div>
          )
        })}
        {/* Empty state */}
        <AnimatePresence mode="wait">
          {sortedPlans.length === 0 && !editMode && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Calendar size={28} style={{ color: 'var(--text-quaternary)', opacity: 0.4 }} strokeWidth={1.2} />
              <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-quaternary)' }}>
                暂无计划
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
              flexShrink: 0,
            }}
          >
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              已选 {selectedIds.size} 项
            </span>
            <Button
              variant="danger"
              motionProps={{ whileTap: { scale: 0.95 } }}
              onClick={handleBatchDelete}
            >
              删除
            </Button>
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
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message={deleteTarget?.type === 'batch'
          ? `确定要删除选中的 ${selectedIds.size} 个计划吗？此操作不可撤销。`
          : '确定要删除这个计划吗？此操作不可撤销。'}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {contextMenu && (
        <ContextMenu
          items={[
            { label: '开始专注', icon: <Timer size={13} />, textColor: '#FF9F0A', hoverColor: 'rgba(255,159,10,0.1)', onClick: () => handleStartFocusFromPlan(contextMenu.planId) },
            { label: '查看详情', icon: <FileText size={13} />, onClick: () => setActivePlan(contextMenu.planId) },
            { label: '编辑类型和时间', icon: <CalendarRange size={13} />, onClick: () => setEditTarget(contextMenu.planId) },
            { label: '删除计划', icon: <Trash2 size={13} />, danger: true, onClick: () => handleSingleDelete(contextMenu.planId) },
          ]}
          anchorRect={contextMenu.rect}
          onClose={() => setContextMenu(null)}
        />
      )}

      {editTarget && (() => {
        const targetPlan = plans.find((p) => p.id === editTarget)
        if (!targetPlan) return null
        return (
          <PlanEditDialog
            plan={targetPlan}
            onConfirm={async (newType, newStart, newEnd) => {
              await updatePlan(editTarget, { planType: newType, startDate: newStart, endDate: newEnd })
              setEditTarget(null)
              useToastStore.getState().show('计划已更新')
            }}
            onCancel={() => setEditTarget(null)}
          />
        )
      })()}
    </div>
  )
}
