import {
  CalendarDays,
  Timer,
  FileText,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useNavigationStore } from '@/stores/navigationStore'

const NAV_ITEMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'planner', label: '计划', icon: CalendarDays },
  { id: 'timer', label: '专注', icon: Timer },
  { id: 'notes', label: '笔记', icon: FileText },
  { id: 'settings', label: '设置', icon: Settings },
]

interface IconStripProps {
  activePanel: string
}

export default function IconStrip({ activePanel }: IconStripProps) {
  const navPush = useNavigationStore((s) => s.push)

  return (
    <div className="flex flex-col items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = activePanel === item.id
        const ItemIcon = item.icon

        return (
          <motion.button
            key={item.id}
            onClick={() => {
              const id = item.id
              if (id === 'planner') navPush({ panel: 'planner', subView: 'list' })
              else if (id === 'notes') navPush({ panel: 'notes', subView: 'list' })
              else navPush({ panel: id as any })
            }}
            title={item.label}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? 'rgba(10,132,255,0.14)' : 'transparent',
              color: isActive ? 'var(--accent-blue)' : 'var(--text-quaternary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s ease, background 0.2s ease',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--accent-blue)'
                e.currentTarget.style.background = 'rgba(10,132,255,0.08)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-quaternary)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <ItemIcon size={19} strokeWidth={1.7} />
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                style={{
                  position: 'absolute',
                  left: 2,
                  top: 12,
                  width: 3,
                  height: 18,
                  borderRadius: 2,
                  background: 'var(--accent-blue)',
                }}
                transition={{ type: 'tween', duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
