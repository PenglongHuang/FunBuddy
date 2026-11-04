import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import DatePicker from '@/components/common/DatePicker'
import useEscapeToCancel from '@/hooks/useEscapeToCancel'
import type { PlanType } from '@/types/plan'

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

interface PlanCreateDialogProps {
  onConfirm: (title: string, startDate: string, endDate: string | null, planType: PlanType) => void
  onCancel: () => void
}

export default function PlanCreateDialog({ onConfirm, onCancel }: PlanCreateDialogProps) {
  const [planType, setPlanType] = useState<PlanType>('daily')
  const [title, setTitle] = useState('')

  const weekBounds = useMemo(() => getWeekBounds(), [])
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [weekStart, setWeekStart] = useState(weekBounds.start)
  const [weekEnd, setWeekEnd] = useState(weekBounds.end)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth)

  useEscapeToCancel(true, onCancel)

  const placeholder = useMemo(() => {
    switch (planType) {
      case 'daily': return `${selectedDate}-日计划`
      case 'weekly': return `${weekStart}-周计划`
      case 'monthly': return `${selectedMonth}-月计划`
      default: return '新计划'
    }
  }, [planType, selectedDate, weekStart, selectedMonth])

  const handleConfirm = () => {
    const t = title.trim() || placeholder
    switch (planType) {
      case 'daily':
        onConfirm(t, selectedDate, null, 'daily')
        break
      case 'weekly':
        onConfirm(t, weekStart, weekEnd, 'weekly')
        break
      case 'monthly': {
        const range = monthToRange(selectedMonth)
        onConfirm(t, range.start, range.end, 'monthly')
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
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
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
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-xl)',
            padding: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <span style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600 }}>
              新建计划
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
                onClick={() => setPlanType(key)}
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

          {/* Title input */}
          <div style={{ marginBottom: 16 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%',
                height: 36,
                padding: '0 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 14,
                border: '1px solid transparent',
                outline: 'none',
                transition: 'border-color 0.15s ease',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent-blue)' }}
              onBlur={(e) => { e.target.style.borderColor = 'transparent' }}
            />
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
              style={{
                padding: '0 20px',
                height: 34,
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--accent-blue)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              创建
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
