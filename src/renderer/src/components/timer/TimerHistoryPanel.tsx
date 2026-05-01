import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { useTimerStore } from '@/stores/timerStore'
import { usePlanStore } from '@/stores/planStore'
import type { TimerHistoryEntry } from '@/types/timer'

type TabKey = 'today' | 'week' | 'calendar'

export default function TimerHistoryPanel() {
  const history = useTimerStore((s) => s.history)
  const todayCount = useTimerStore((s) => s.todayCount)
  const todayMinutes = useTimerStore((s) => s.todayMinutes)
  const plans = usePlanStore((s) => s.plans)

  const [activeTab, setActiveTab] = useState<TabKey>('today')

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const todayEntries = useMemo(
    () => history.filter((h) => h.completedAt.startsWith(today)).reverse(),
    [history, today]
  )

  const resolvePlan = (planId: string | undefined) => {
    if (!planId) return null
    return plans.find((p) => p.id === planId) ?? null
  }

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'today', label: '今天' },
    { key: 'week', label: '近7天' },
    { key: 'calendar', label: '日历' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 1, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', padding: 2 }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 'var(--radius-full)',
              fontSize: 11, fontWeight: activeTab === key ? 600 : 400,
              background: activeTab === key ? 'var(--bg-base)' : 'transparent',
              color: activeTab === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              border: 'none', cursor: 'pointer',
              boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              transition: 'color 0.2s, background 0.2s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'today' && (
        <TodayView entries={todayEntries} resolvePlan={resolvePlan} formatTime={formatTime} />
      )}
      {activeTab === 'week' && (
        <WeekView entries={history} resolvePlan={resolvePlan} formatTime={formatTime} />
      )}
      {activeTab === 'calendar' && (
        <CalendarView entries={history} resolvePlan={resolvePlan} formatTime={formatTime} />
      )}
    </div>
  )
}

function TodayView({ entries, resolvePlan, formatTime }: {
  entries: TimerHistoryEntry[]
  resolvePlan: (id?: string) => { title: string; color: string } | null
  formatTime: (iso: string) => string
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div style={{ position: 'relative', paddingLeft: 18, maxHeight: 130, overflowY: 'auto' }}>
        <div style={{ position: 'absolute', left: 5, top: 4, bottom: 4, width: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
        {entries.slice(0, 10).map((entry, i) => {
          const plan = resolvePlan(entry.planId)
          const isLast = i === entries.length - 1
          return (
            <div key={entry.completedAt} style={{ position: 'relative', marginBottom: isLast ? 0 : 8 }}>
              <div style={{ position: 'absolute', left: -15, top: 6, width: 8, height: 8, borderRadius: '50%', background: plan ? '#FF9F0A' : 'rgba(255,159,10,0.4)', border: '2px solid var(--bg-base)' }} />
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>{formatTime(entry.completedAt)}</span>
                  <span style={{ color: '#FF9F0A', fontSize: 11 }}>{entry.durationMinutes} min</span>
                </div>
                {plan ? (
                  <div style={{ marginTop: 3 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${plan.color}18`, color: plan.color }}>{plan.title}</span>
                  </div>
                ) : entry.planId ? (
                  <div style={{ marginTop: 3, color: 'var(--text-quaternary)', fontSize: 10 }}>已删除计划</div>
                ) : null}
              </div>
            </div>
          )
        })}
        {entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-quaternary)', fontSize: 12 }}>今天还没有专注记录</div>
        )}
      </div>
    </motion.div>
  )
}

function WeekView({ entries, resolvePlan, formatTime }: {
  entries: TimerHistoryEntry[]
  resolvePlan: (id?: string) => { title: string; color: string } | null
  formatTime: (iso: string) => string
}) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  const weekDays = useMemo(() => {
    const days: Array<{ date: string; label: string; entries: TimerHistoryEntry[]; count: number; minutes: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const dayEntries = entries.filter((h) => h.completedAt.startsWith(dateStr))
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      days.push({
        date: dateStr,
        label: i === 0 ? '今天' : i === 1 ? '昨天' : `周${weekdays[d.getDay()]}`,
        entries: [...dayEntries].reverse(),
        count: dayEntries.length,
        minutes: dayEntries.reduce((s, h) => s + h.durationMinutes, 0),
      })
    }
    return days.reverse()
  }, [entries])

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ maxHeight: 130, overflowY: 'auto' }}>
      {weekDays.filter((d) => d.count > 0).map((day) => (
        <div key={day.date} style={{ marginBottom: 4 }}>
          <button
            onClick={() => setExpandedDate(expandedDate === day.date ? null : day.date)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, textAlign: 'left' }}
          >
            <span style={{ flex: 1, fontWeight: 500 }}>{day.date.slice(5)} {day.label}</span>
            <span style={{ color: '#64D2FF', fontSize: 11 }}>{day.count}轮</span>
            <span style={{ color: '#0A84FF', fontSize: 11, marginLeft: 6 }}>{day.minutes}min</span>
            <span style={{ color: 'var(--text-quaternary)', fontSize: 10 }}>{expandedDate === day.date ? '▲' : '▼'}</span>
          </button>
          {expandedDate === day.date && (
            <div style={{ paddingLeft: 18, position: 'relative', marginTop: 4 }}>
              <div style={{ position: 'absolute', left: 5, top: 4, bottom: 4, width: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
              {day.entries.map((entry) => {
                const plan = resolvePlan(entry.planId)
                return (
                  <div key={entry.completedAt} style={{ position: 'relative', marginBottom: 6 }}>
                    <div style={{ position: 'absolute', left: -15, top: 6, width: 8, height: 8, borderRadius: '50%', background: plan ? '#FF9F0A' : 'rgba(255,159,10,0.4)', border: '2px solid var(--bg-base)' }} />
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatTime(entry.completedAt)}</span>
                        <span style={{ color: '#FF9F0A', fontSize: 11 }}>{entry.durationMinutes} min</span>
                      </div>
                      {plan && (
                        <div style={{ marginTop: 3 }}>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${plan.color}18`, color: plan.color }}>{plan.title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
      {weekDays.every((d) => d.count === 0) && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-quaternary)', fontSize: 12 }}>近7天没有专注记录</div>
      )}
    </motion.div>
  )
}

function CalendarView({ entries, resolvePlan, formatTime }: {
  entries: TimerHistoryEntry[]
  resolvePlan: (id?: string) => { title: string; color: string } | null
  formatTime: (iso: string) => string
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { daysInMonth, firstDayOfWeek, monthLabel } = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1).getDay()
    const days = new Date(y, m, 0).getDate()
    return { daysInMonth: days, firstDayOfWeek: firstDay, monthLabel: `${y}年${m}月` }
  }, [viewMonth])

  const dateCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of entries) {
      const date = e.completedAt.split('T')[0]
      counts[date] = (counts[date] || 0) + 1
    }
    return counts
  }, [entries])

  const selectedEntries = useMemo(() => {
    if (!selectedDate) return []
    return entries.filter((h) => h.completedAt.startsWith(selectedDate)).reverse()
  }, [entries, selectedDate])

  const changeMonth = (delta: number) => {
    const [y, m] = viewMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setSelectedDate(null)
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px 8px', fontSize: 12 }}>◀</button>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{monthLabel}</span>
        <button onClick={() => changeMonth(1)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px 8px', fontSize: 12 }}>▶</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', fontSize: 10, color: 'var(--text-quaternary)', marginBottom: 4 }}>
        {['日', '一', '二', '三', '四', '五', '六'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const [y, m] = viewMonth.split('-').map(Number)
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const count = dateCounts[dateStr] || 0
          const isToday = dateStr === todayStr
          const isFuture = new Date(dateStr) > new Date(todayStr)
          const isSelected = selectedDate === dateStr
          return (
            <button
              key={dateStr}
              onClick={() => !isFuture && setSelectedDate(selectedDate === dateStr ? null : dateStr)}
              disabled={isFuture}
              style={{
                padding: '4px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: isFuture ? 'default' : 'pointer',
                background: isSelected ? 'rgba(255,159,10,0.15)' : 'transparent',
                fontSize: 11, fontWeight: isToday || count > 0 ? 600 : 400,
                color: isFuture ? 'var(--text-quaternary)' : isToday ? '#FF9F0A' : count > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}
            >
              {day}
              {count > 0 && <div style={{ fontSize: 8, color: '#FF9F0A', lineHeight: 1 }}>{count}</div>}
            </button>
          )
        })}
      </div>
      {selectedDate && (
        <div style={{ marginTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 8, paddingLeft: 18, position: 'relative', maxHeight: 100, overflowY: 'auto' }}>
          <div style={{ position: 'absolute', left: 5, top: 12, bottom: 4, width: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
          {selectedEntries.map((entry) => {
            const plan = resolvePlan(entry.planId)
            return (
              <div key={entry.completedAt} style={{ position: 'relative', marginBottom: 6 }}>
                <div style={{ position: 'absolute', left: -15, top: 6, width: 8, height: 8, borderRadius: '50%', background: plan ? '#FF9F0A' : 'rgba(255,159,10,0.4)', border: '2px solid var(--bg-base)' }} />
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatTime(entry.completedAt)}</span>
                    <span style={{ color: '#FF9F0A', fontSize: 11 }}>{entry.durationMinutes} min</span>
                  </div>
                  {plan && <div style={{ marginTop: 3 }}><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${plan.color}18`, color: plan.color }}>{plan.title}</span></div>}
                </div>
              </div>
            )
          })}
          {selectedEntries.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 12, padding: '8px 0' }}>该日没有记录</div>
          )}
        </div>
      )}
    </motion.div>
  )
}
