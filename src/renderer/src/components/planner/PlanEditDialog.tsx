import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import DatePicker from '@/components/common/DatePicker'
import useEscapeToCancel from '@/hooks/useEscapeToCancel'
import type { Plan, PlanType } from '@/types/plan'

const PLAN_TYPE_OPTIONS: Array<{ key: PlanType; label: string }> = [
  { key: 'daily', label: '日计划' },
  { key: 'weekly', label: '周计划' },
  { key: 'monthly', label: '月计划' },
]

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekBounds(): { start: string; end: string } {
  const d = new Date()
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  return { start: fmt(monday), end: fmt(sunday) }
}

function getCurrentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthToRange(monthStr: string): { start: string; end: string } {
  const [y, m] = monthStr.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    start: `${y}-${String(m).padStart(2, '0')}-01`,
    end: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

function dateToMonth(dateStr: string): string {
  return dateStr.slice(0, 7)
}

interface PlanEditDialogProps {
  plan: Plan
  onConfirm: (planType: PlanType, startDate: string, endDate: string | null) => void
  onCancel: () => void
}

export default function PlanEditDialog({ plan, onConfirm, onCancel }: PlanEditDialogProps) {
  const initialType = plan.planType || 'daily'
  const [planType, setPlanType] = useState<PlanType>(initialType)

  // Initialize dates from current plan
  const [selectedDate, setSelectedDate] = useState(plan.startDate)
  const [weekStart, setWeekStart] = useState(plan.startDate)
  const [weekEnd, setWeekEnd] = useState(plan.endDate || plan.startDate)
  const [selectedMonth, setSelectedMonth] = useState(dateToMonth(plan.startDate))

  useEscapeToCancel(true, onCancel)

  // When type changes, reset dates to defaults for the new type
  const handleTypeChange = (newType: PlanType) => {
    setPlanType(newType)
    if (newType !== initialType) {
      switch (newType) {
        case 'daily':
          setSelectedDate(todayStr())
          break
        case 'weekly': {
          const bounds = getWeekBounds()
          setWeekStart(bounds.start)
          setWeekEnd(bounds.end)
          break
        }
        case 'monthly':
          setSelectedMonth(getCurrentMonth())
          break
      }
    } else {
      // Switching back to original type, restore original dates
      setSelectedDate(plan.startDate)
      setWeekStart(plan.startDate)
      setWeekEnd(plan.endDate || plan.startDate)
      setSelectedMonth(dateToMonth(plan.startDate))
    }
  }

  const hasChanges = useMemo(() => {
    if (planType !== plan.planType) return true
    switch (planType) {
      case 'daily':
        return selectedDate !== plan.startDate
      case 'weekly':
        return weekStart !== plan.startDate || weekEnd !== (plan.endDate || plan.startDate)
      case 'monthly': {
        const range = monthToRange(selectedMonth)
        return range.start !== plan.startDate || range.end !== plan.endDate
      }
      default:
        return false
    }
  }, [planType, selectedDate, weekStart, weekEnd, selectedMonth, plan])

  const handleConfirm = () => {
    switch (planType) {
      case 'daily':
        onConfirm('daily', selectedDate, null)
        break
      case 'weekly':
        onConfirm('weekly', weekStart, weekEnd)
        break
      case 'monthly': {
        const range = monthToRange(selectedMonth)
        onConfirm('monthly', range.start, range.end)
        break
      }
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
          position: 'absolute',
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
            width: 320,
            maxWidth: 'calc(100vw - 48px)',
            background: 'rgba(44, 44, 46, 0.98)',
            borderRadius: 'var(--radius-xl)',
            padding: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <span style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600 }}>
              编辑计划
            </span>
            <button
              onClick={onCancel}
              style={{
                width: 26,
                height: 26,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Plan type selector */}
          <div
            className="flex gap-0.5 p-1"
            style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-full)',
              marginBottom: 16,
            }}
          >
            {PLAN_TYPE_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleTypeChange(key)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 12,
                  fontWeight: 500,
                  background: planType === key ? 'var(--bg-base)' : 'transparent',
                  color: planType === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease, background 0.2s ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date picker area */}
          <div style={{ marginBottom: 16 }}>
            {planType === 'daily' && (
              <DatePicker value={selectedDate} onChange={setSelectedDate} mode="date" />
            )}
            {planType === 'weekly' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
                    起始日期
                  </span>
                  <DatePicker value={weekStart} onChange={setWeekStart} mode="date" />
                </div>
                <div>
                  <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
                    结束日期
                  </span>
                  <DatePicker value={weekEnd} onChange={setWeekEnd} mode="date" />
                </div>
              </div>
            )}
            {planType === 'monthly' && (
              <DatePicker value={selectedMonth} onChange={setSelectedMonth} mode="month" />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-end">
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
                background: hasChanges ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                color: hasChanges ? 'white' : 'var(--text-quaternary)',
                border: 'none',
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s ease, color 0.2s ease',
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
