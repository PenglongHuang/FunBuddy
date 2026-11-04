import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { usePlanStore } from '@/stores/planStore'
import { useTimerStore } from '@/stores/timerStore'
import { formatFocusTime } from '@/lib/format-time'
import useEscapeToCancel from '@/hooks/useEscapeToCancel'

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateRange(startDate: string, endDate: string | null): string {
  const s = formatShortDate(startDate)
  const e = endDate ? formatShortDate(endDate) : null
  return e && e !== s ? `${s} - ${e}` : s
}

interface FocusStartDialogProps {
  onCancel: () => void
}

export default function FocusStartDialog({ onCancel }: FocusStartDialogProps) {
  const plans = usePlanStore((s) => s.plans)
  const lastSelectedPlanId = useTimerStore((s) => s.lastSelectedPlanId)
  const startWithPlan = useTimerStore((s) => s.startWithPlan)
  const start = useTimerStore((s) => s.start)
  const getPlanFocusMinutes = useTimerStore((s) => s.getPlanFocusMinutes)
  const sortedPlans = [...plans].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  const defaultPlanId = lastSelectedPlanId ?? null
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(defaultPlanId)

  useEscapeToCancel(true, onCancel)

  const handleStart = () => {
    if (selectedPlanId) {
      startWithPlan(selectedPlanId)
    } else {
      start()
    }
    onCancel()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
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
            maxWidth: 'calc(100vw - 48px)',
            background: 'rgba(44, 44, 46, 0.98)',
            borderRadius: 'var(--radius-xl)',
            padding: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <span style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600 }}>
              开始专注
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
          <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 12 }}>
            选择要专注的任务
          </div>

          {/* Plan list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', marginBottom: 14 }}>
            {/* Free focus option */}
            <motion.div
              onClick={() => setSelectedPlanId(null)}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                background: selectedPlanId === null ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                border: selectedPlanId === null ? '1px dashed rgba(10,132,255,0.5)' : '1px solid rgba(255,255,255,0.04)',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>🎯</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  color: selectedPlanId === null ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  display: 'block',
                }}>
                  自由专注
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-quaternary)', display: 'block' }}>
                  不关联任何计划
                </span>
              </div>
              {selectedPlanId === null && (
                <span style={{ color: 'var(--accent-blue)', fontSize: 12, flexShrink: 0 }}>✓</span>
              )}
            </motion.div>

            {sortedPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id
              return (
                <motion.div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    background: isSelected ? `${plan.color}12` : 'rgba(255,255,255,0.02)',
                    border: isSelected ? `1px solid ${plan.color}40` : '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: plan.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {plan.title}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-quaternary)' }}>
                      {formatDateRange(plan.startDate, plan.endDate)} · ⏱ {formatFocusTime(getPlanFocusMinutes(plan.id))}
                    </span>
                  </div>
                  {isSelected && (
                    <span style={{ color: plan.color, fontSize: 12, flexShrink: 0 }}>✓</span>
                  )}
                </motion.div>
              )
            })}
            {sortedPlans.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-quaternary)', fontSize: 12 }}>
                暂无计划
              </div>
            )}
          </div>

          {/* Button */}
          <button
            onClick={handleStart}
            style={{
              width: '100%', textAlign: 'center', padding: '8px 0', borderRadius: 'var(--radius-sm)',
              fontSize: 13, fontWeight: 600, background: 'rgba(10,132,255,0.2)',
              color: '#0A84FF', border: 'none', cursor: 'pointer',
            }}
          >
            开始
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
