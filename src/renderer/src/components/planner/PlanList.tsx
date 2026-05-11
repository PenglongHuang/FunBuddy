import { useState, useMemo, useEffect, useCallback } from 'react'
import { usePlanStore } from '@/stores/planStore'
import { Plus, CheckSquare, Square, Calendar, Trash2, Timer, FileText, CalendarRange } from 'lucide-react'
import type { PlanTypeFilterValue } from '@/components/common/PlanTypeFilter'
import SearchBar from '@/components/common/SearchBar'
import PlanToolbar from '@/components/planner/PlanToolbar'
import PlanCard from '@/components/planner/PlanCard'
import { motion, AnimatePresence } from 'motion/react'
import PlanCreateDialog from './PlanCreateDialog'
import PlanEditDialog from './PlanEditDialog'
import { Button, ContextMenu, ConfirmDialog } from '@/components/ui'
import { useTimerStore } from '@/stores/timerStore'
import { useToastStore } from '@/stores/toastStore'
import { useNavigationStore } from '@/stores/navigationStore'
import type { PlanType } from '@/types/plan'

export default function PlanList() {
  const plans = usePlanStore((s) => s.plans)
  const loaded = usePlanStore((s) => s.loaded)
  const createPlan = usePlanStore((s) => s.createPlan)
  const deletePlan = usePlanStore((s) => s.deletePlan)
  const deletePlans = usePlanStore((s) => s.deletePlans)
  const setActivePlan = usePlanStore((s) => s.setActivePlan)
  const activePlanId = usePlanStore((s) => s.activePlanId)
  const sortBy = usePlanStore((s) => s.sortBy)
  const viewMode = usePlanStore((s) => s.viewMode)
  const setSortBy = usePlanStore((s) => s.setSortBy)
  const setViewMode = usePlanStore((s) => s.setViewMode)
  const updatePlan = usePlanStore((s) => s.updatePlan)
  const navPush = useNavigationStore((s) => s.push)

  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null)
  const [planTypeFilter, setPlanTypeFilter] = useState<PlanTypeFilterValue>('all')
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single'; id: string } | { type: 'batch' } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ planId: string; rect: DOMRect } | null>(null)
  const [editTarget, setEditTarget] = useState<string | null>(null)

  const filteredPlans = useMemo(() => {
    let result = plans
    if (planTypeFilter !== 'all') {
      result = result.filter((p) => p.planType === planTypeFilter)
    }
    if (activeFilterTag !== null) {
      result = result.filter((p) => (p.tags ?? []).includes(activeFilterTag))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    }
    return result
  }, [plans, planTypeFilter, activeFilterTag, searchQuery])

  const sortedPlans = useMemo(() => {
    const sorted = [...filteredPlans]
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
        break
      case 'planDate':
        sorted.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        break
      default:
        sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
    return sorted
  }, [filteredPlans, sortBy])



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
    navPush({ panel: 'planner', subView: 'editor', planId: plan.id })
    setShowCreateDialog(false)
    useToastStore.getState().show('新建计划成功')
  }

  const handleSingleDelete = (id: string) => {
    setDeleteTarget({ type: 'single', id })
  }

  const handleStartFocusFromPlan = (planId: string) => {
    navPush({ panel: 'timer' })
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

  if (!loaded) {
    return (
      <div style={{ fontSize: 12, color: '#48484a', textAlign: 'center', padding: '32px 0' }}>
        加载中...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ gap: 0, position: 'relative' }}>
      {/* TitleBar */}
      <div className="flex items-center justify-between shrink-0" style={{ padding: '6px 12px' }}>
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
            <span style={{ fontSize: 12, color: '#8e8e93' }}>
              {searchQuery ? `搜索 "${searchQuery}" · ${sortedPlans.length} 个结果` : `${sortedPlans.length} 个计划`}
            </span>
            <div className="flex items-center gap-1">
              {plans.length > 0 && <Button variant="ghost" onClick={() => setEditMode(true)}>管理</Button>}
              <Button variant="primary" icon={<Plus size={13} strokeWidth={2.5} />} onClick={() => setShowCreateDialog(true)}>新建</Button>
            </div>
          </>
        )}
      </div>

      {/* Search */}
      {!editMode && (
        <SearchBar placeholder="搜索计划标题..." value={searchQuery} onChange={setSearchQuery} />
      )}

      {/* Toolbar + divider */}
      {!editMode && plans.length > 0 && (
        <>
          <PlanToolbar
            plans={filteredPlans}
            planTypeFilter={planTypeFilter}
            onPlanTypeFilterChange={setPlanTypeFilter}
            activeFilterTag={activeFilterTag}
            onActiveFilterTagChange={setActiveFilterTag}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={(mode) => {
              if (mode === 'calendar') navPush({ panel: 'planner', subView: 'calendar' })
              else setViewMode(mode)
            }}
            editMode={editMode}
          />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 12px' }} />
        </>
      )}

      {/* Card list */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{
        display: viewMode === 'compact' ? 'grid' : 'flex',
        flexDirection: 'column',
        ...(viewMode === 'compact'
          ? { gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, alignContent: 'start' }
          : { gap: 8, padding: '0 12px' }),
      }}>
        {sortedPlans.length === 0 && !editMode ? (
          <motion.div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Calendar size={28} style={{ color: '#48484a', opacity: 0.4 }} strokeWidth={1.2} />
            <span style={{ fontSize: 12, color: '#48484a' }}>
              {searchQuery ? '未找到匹配的计划' : plans.length === 0 ? '暂无计划' : '未找到匹配的计划'}
            </span>
          </motion.div>
        ) : (
          sortedPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              viewMode={viewMode}
              isActive={activePlanId === plan.id}
              isSelected={selectedIds.has(plan.id)}
              editMode={editMode}
              searchQuery={searchQuery || undefined}
              onFocusClick={handleStartFocusFromPlan}
              onMoreClick={(planId, rect) => setContextMenu({ planId, rect })}
              onClick={(id) => navPush({ panel: 'planner', subView: 'editor', planId: id })}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
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
            <Button variant="danger" motionProps={{ whileTap: { scale: 0.95 } }} onClick={handleBatchDelete}>
              删除
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      {!editMode && (
        <div
          onClick={() => setShowCreateDialog(true)}
          style={{
            position: 'absolute', bottom: 16, right: 16,
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0A84FF, #5856D6)',
            boxShadow: '0 4px 14px rgba(10,132,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18, color: '#fff', fontWeight: 300,
            zIndex: 10,
          }}
        >
          +
        </div>
      )}

      {/* Create dialog */}
      {showCreateDialog && (
        <PlanCreateDialog
          onConfirm={handleCreateConfirm}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message={deleteTarget?.type === 'batch'
          ? `确定要删除选中的 ${selectedIds.size} 个计划吗？此操作不可撤销。`
          : '确定要删除这个计划吗？此操作不可撤销。'}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          items={[
            { label: '开始专注', icon: <Timer size={13} />, textColor: '#FF9F0A', hoverColor: 'rgba(255,159,10,0.1)', onClick: () => handleStartFocusFromPlan(contextMenu.planId) },
            { label: '查看详情', icon: <FileText size={13} />, onClick: () => navPush({ panel: 'planner', subView: 'editor', planId: contextMenu.planId }) },
            { label: '编辑类型和时间', icon: <CalendarRange size={13} />, onClick: () => setEditTarget(contextMenu.planId) },
            { label: '删除计划', icon: <Trash2 size={13} />, danger: true, onClick: () => handleSingleDelete(contextMenu.planId) },
          ]}
          anchorRect={contextMenu.rect}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Edit dialog */}
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
