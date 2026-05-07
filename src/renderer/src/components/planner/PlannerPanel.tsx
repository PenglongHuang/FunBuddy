import { useEffect, useState } from 'react'
import { usePlanStore } from '@/stores/planStore'
import PlanList from './PlanList'
import CalendarView from './CalendarView'
import PlanEditor from './PlanEditor'
import { LayoutList, CalendarDays } from 'lucide-react'
import { motion } from 'motion/react'

export default function PlannerPanel() {
  const load = usePlanStore((s) => s.load)
  const activePlanId = usePlanStore((s) => s.activePlanId)
  const [view, setView] = useState<'list' | 'calendar'>('list')

  useEffect(() => { load() }, [load])

  if (activePlanId) {
    return <PlanEditor planId={activePlanId} />
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* View switcher */}
      <div
        className="flex gap-0.5 p-1 self-center"
        style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-full)',
        }}
      >
        {([['list', LayoutList, '计划列表'], ['calendar', CalendarDays, '日历']] as const).map(([key, Icon, label]) => (
          <motion.button
            key={key}
            onClick={() => setView(key)}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'clamp(12px, 2.5cqw, 15px)',
              fontWeight: 500,
              background: view === key ? 'var(--bg-base)' : 'transparent',
              color: view === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s ease, background 0.2s ease',
            }}
          >
            <Icon size={13} />
            {label}
          </motion.button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === 'list' ? <PlanList onSwitchToCalendar={() => setView('calendar')} /> : <CalendarView />}
      </div>
    </div>
  )
}
