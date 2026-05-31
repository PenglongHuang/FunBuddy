import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { usePlanStore } from '@/stores/planStore'
import SearchableSelect from '@/components/common/SearchableSelect'
import type { TimerHistoryEntry } from '@/types/timer'

interface FocusRecordEditDialogProps {
  entry: TimerHistoryEntry
  onConfirm: (updates: {
    completedAt?: string
    durationMinutes?: number
    planId?: string | null
  }) => void
  onCancel: () => void
}

function isoToDatetimeLocal(iso: string): string {
  return iso.slice(0, 16)
}

function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString()
}

export default function FocusRecordEditDialog({ entry, onConfirm, onCancel }: FocusRecordEditDialogProps) {
  const snapshot = useRef(entry)
  const plans = usePlanStore((s) => s.plans)

  const [completedAt, setCompletedAt] = useState(() => isoToDatetimeLocal(entry.completedAt))
  const [durationMinutes, setDurationMinutes] = useState(entry.durationMinutes)
  const [planId, setPlanId] = useState<string | null>(entry.planId ?? null)

  const original = snapshot.current

  const FREE_FOCUS_VALUE = '__free__'

  const planItems = useMemo(() => [
    { value: FREE_FOCUS_VALUE, label: '自由专注', icon: <span style={{ color: '#FF9F0A' }}>🎯</span> },
    ...plans.map((p) => ({
      value: p.id,
      label: p.title,
      icon: <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />,
    })),
  ], [plans])

  const selectValue = planId ?? FREE_FOCUS_VALUE

  const hasChanges = useMemo(() => {
    if (datetimeLocalToIso(completedAt) !== original.completedAt) return true
    if (durationMinutes !== original.durationMinutes) return true
    const newPlanId = planId ?? undefined
    const origPlanId = original.planId
    if (newPlanId !== origPlanId) return true
    return false
  }, [completedAt, durationMinutes, planId, original])

  const handleConfirm = () => {
    const updates: { completedAt?: string; durationMinutes?: number; planId?: string | null } = {}
    if (datetimeLocalToIso(completedAt) !== original.completedAt) {
      updates.completedAt = datetimeLocalToIso(completedAt)
    }
    if (durationMinutes !== original.durationMinutes) {
      updates.durationMinutes = durationMinutes
    }
    const newPlanId = planId ?? undefined
    const origPlanId = original.planId
    if (newPlanId !== origPlanId) {
      updates.planId = planId
    }
    if (Object.keys(updates).length > 0) {
      onConfirm(updates)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 300,
            background: 'rgba(44, 44, 46, 0.98)',
            borderRadius: 'var(--radius-xl)',
            padding: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              编辑记录
            </span>
            <button
              onClick={onCancel}
              style={{
                width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)', border: 'none',
                color: 'var(--text-tertiary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Completed time */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>完成时间</div>
            <input
              type="datetime-local"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: 12,
                color: 'var(--text-primary)',
                outline: 'none',
                colorScheme: 'dark',
              }}
            />
          </div>

          {/* Duration */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>专注时长</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                min={1}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(1, Math.min(480, Number(e.target.value) || 1)))}
                style={{
                  width: 72,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>分钟</span>
            </div>
          </div>

          {/* Plan selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>关联计划</div>
            <SearchableSelect
              items={planItems}
              value={selectValue}
              placeholder="选择计划"
              searchPlaceholder="搜索计划..."
              onChange={(v) => setPlanId(v === FREE_FOCUS_VALUE ? null : v)}
              width={240}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
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
              onClick={handleConfirm}
              disabled={!hasChanges}
              style={{
                padding: '0 20px',
                height: 34,
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                background: hasChanges ? '#FF9F0A' : 'var(--bg-tertiary)',
                color: hasChanges ? '#000' : 'var(--text-quaternary)',
                border: 'none',
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              保存
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
