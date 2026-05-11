import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { usePlanStore } from '@/stores/planStore'
import { useNavigationStore } from '@/stores/navigationStore'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

interface CalendarViewProps {
  onSwitchView: (mode: 'card' | 'compact') => void
}

export default function CalendarView({ onSwitchView }: CalendarViewProps) {
  const plans = usePlanStore((s) => s.plans)
  const getPlansForDate = usePlanStore((s) => s.getPlansForDate)
  const navPush = useNavigationStore((s) => s.push)
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  const datePlans = useMemo(() => {
    if (!selectedDate) return []
    return getPlansForDate(selectedDate)
  }, [selectedDate, plans, getPlansForDate])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const cells: Array<{ day: number | null; dateStr: string }> = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: '' })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, dateStr })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <motion.button
          onClick={prevMonth}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          style={{
            width: 28, height: 28, borderRadius: 'var(--radius-sm)',
            background: 'transparent', border: 'none',
            color: 'var(--text-tertiary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronLeft size={15} />
        </motion.button>
        <span style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600 }}>
          {year}年{month + 1}月
        </span>
        <div className="flex items-center gap-1">
          <motion.button
            onClick={nextMonth}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{
              width: 28, height: 28, borderRadius: 'var(--radius-sm)',
              background: 'transparent', border: 'none',
              color: 'var(--text-tertiary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronRight size={15} />
          </motion.button>
          {/* View toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
            padding: 2,
          }}>
            <button
              onClick={() => onSwitchView('card')}
              style={{
                padding: '3px 6px',
                borderRadius: 6,
                fontSize: 11,
                background: 'transparent',
                color: '#636366',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ☰
            </button>
            <button
              onClick={() => onSwitchView('compact')}
              style={{
                padding: '3px 6px',
                borderRadius: 6,
                fontSize: 11,
                background: 'transparent',
                color: '#636366',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ⊞
            </button>
            <button
              style={{
                padding: '3px 6px',
                borderRadius: 6,
                fontSize: 11,
                background: 'rgba(10,132,255,0.2)',
                color: '#64D2FF',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              📅
            </button>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} style={{ font: 'var(--text-caption-2)', color: 'var(--text-quaternary)', paddingBottom: 6 }}>
            {w}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-0.5 justify-items-center">
        {cells.map((cell, i) => {
          if (!cell.day) return <div key={`e${i}`} style={{ width: 32, height: 32 }} />

          const isToday = cell.dateStr === todayStr
          const isSelected = selectedDate === cell.dateStr
          const dayPlans = getPlansForDate(cell.dateStr)
          const uniqueColors = [...new Set(dayPlans.map((p) => p.color))]

          return (
            <motion.div
              key={cell.dateStr}
              onClick={() => setSelectedDate(cell.dateStr)}
              whileTap={{ scale: 0.92 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: isToday
                  ? 'rgba(10,132,255,0.16)'
                  : isSelected
                    ? 'var(--bg-secondary)'
                    : 'transparent',
                transition: 'background 0.15s ease',
              }}
            >
              <span style={{
                fontSize: 12,
                fontWeight: isToday ? 600 : 400,
                color: isToday ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                lineHeight: 1,
              }}>
                {cell.day}
              </span>
              {uniqueColors.length > 0 && (
                <div className="flex gap-0.5" style={{ marginTop: 2 }}>
                  {uniqueColors.slice(0, 3).map((c) => (
                    <div key={c} style={{ width: 3, height: 3, borderRadius: '50%', background: c }} />
                  ))}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Selected date plans */}
      {selectedDate && datePlans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
            marginTop: 4,
          }}
        >
          <div style={{ padding: '10px 14px 6px', font: 'var(--text-caption-2)', color: 'var(--text-tertiary)' }}>
            {selectedDate} 的计划
          </div>
          {datePlans.map((p) => (
            <div
              key={p.id}
              onClick={() => navPush({ panel: 'planner', subView: 'editor', planId: p.id })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                cursor: 'pointer',
                borderTop: '1px solid var(--separator)',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span className="truncate flex-1" style={{ font: 'var(--text-caption-1)', color: 'var(--text-primary)', fontWeight: 500 }}>
                {p.title}
              </span>
              <span style={{ font: 'var(--text-caption-2)', color: 'var(--text-quaternary)' }}>
                {p.startDate}
              </span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
