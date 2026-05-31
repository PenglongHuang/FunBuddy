import { useState, useEffect, useRef } from 'react'
import { CalendarDays, Timer, FileText, Settings, type LucideIcon } from 'lucide-react'
import { usePetStore } from '@/stores/petStore'
import { useTimerStore } from '@/stores/timerStore'
import { useNavigationStore } from '@/stores/navigationStore'

const PANELS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'planner', label: '计划', icon: CalendarDays },
  { id: 'timer', label: '专注', icon: Timer },
  { id: 'notes', label: '笔记', icon: FileText },
  { id: 'settings', label: '设置', icon: Settings },
]

export default function DynamicIsland() {
  const activePanel = usePetStore((s) => s.activePanel)
  const timerStatus = useTimerStore((s) => s.status)
  const remainingMs = useTimerStore((s) => s.remainingMs)
  const timerPause = useTimerStore((s) => s.pause)
  const timerResume = useTimerStore((s) => s.resume)
  const navPush = useNavigationStore((s) => s.push)
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const expandTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Update clock
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setCurrentTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      )
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [])

  const isTimerActive = timerStatus === 'running' || timerStatus === 'paused'

  const handleMouseEnter = () => {
    if (expandTimeoutRef.current) clearTimeout(expandTimeoutRef.current)
    setIsExpanded(true)
  }

  const handleMouseLeave = () => {
    expandTimeoutRef.current = setTimeout(() => setIsExpanded(false), 200)
  }

  const handlePanelClick = (panelId: string) => {
    if (panelId === 'planner') {
      navPush({ panel: 'planner', subView: 'list' })
    } else if (panelId === 'notes') {
      navPush({ panel: 'notes', subView: 'list' })
    } else {
      navPush({ panel: panelId as any })
    }
  }

  const handleToggleTimer = () => {
    if (activePanel !== 'timer') {
      navPush({ panel: 'timer' })
    }
    if (timerStatus === 'running') {
      timerPause()
    } else if (timerStatus === 'paused') {
      timerResume()
    }
  }

  const formatTime = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // Timer active state
  if (isTimerActive) {
    const isRunning = timerStatus === 'running'
    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          WebkitAppRegion: 'no-drag',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 18,
          padding: '4px 10px 4px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 26,
          transition: 'all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      >
        {/* Status dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isRunning ? '#ff453a' : '#ff9f0a',
            boxShadow: isRunning ? '0 0 8px rgba(255,69,58,0.5)' : 'none',
            animation: isRunning ? 'island-pulse 1.5s ease-in-out infinite' : 'none',
            opacity: isRunning ? 1 : 0.7,
            flexShrink: 0,
          }}
        />
        {/* Countdown */}
        <span
          style={{
            color: isRunning ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
            fontSize: 13,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 0.5,
          }}
        >
          {formatTime(remainingMs)}
        </span>
        {/* Divider */}
        <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
        {/* Current time */}
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
          {currentTime}
        </span>
        {/* Pause/play button */}
        <button
          onClick={handleToggleTimer}
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: 0,
          }}
        >
          {isRunning ? (
            <svg width="8" height="8" viewBox="0 0 12 12" fill="rgba(255,255,255,0.6)">
              <rect x="2" y="1" width="2.5" height="10" rx="0.8" />
              <rect x="7.5" y="1" width="2.5" height="10" rx="0.8" />
            </svg>
          ) : (
            <svg width="8" height="8" viewBox="0 0 12 12" fill="rgba(255,255,255,0.6)">
              <path d="M3 1.5 L10 6 L3 10.5Z" />
            </svg>
          )}
        </button>
      </div>
    )
  }

  // Single container for compact + expanded with smooth width transition
  const currentPanel = PANELS.find((p) => p.id === activePanel) ?? PANELS[0]
  const CurrentIcon = currentPanel.icon

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        WebkitAppRegion: 'no-drag',
        background: 'rgba(0,0,0,0.6)',
        borderRadius: 18,
        height: 26,
        overflow: 'hidden',
        position: 'relative',
        maxWidth: isExpanded ? 280 : 120,
        transition: 'max-width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Expanded content — natural width, clipped when container shrinks */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '4px 8px',
          height: 26,
          width: 'max-content',
          opacity: isExpanded ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
      >
        {PANELS.map((panel) => {
          const isActive = activePanel === panel.id
          const Icon = panel.icon
          return (
            <button
              key={panel.id}
              onClick={() => handlePanelClick(panel.id)}
              style={{
                borderRadius: 14,
                padding: '2px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                border: 'none',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                transition: 'background 0.15s ease',
                height: 18,
              }}
            >
              <Icon
                size={12}
                strokeWidth={isActive ? 2.2 : 1.7}
                style={{ color: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)' }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                  whiteSpace: 'nowrap',
                }}
              >
                {panel.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Compact content — absolute overlay, cross-fades in */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 16px',
          opacity: isExpanded ? 0 : 1,
          transition: 'opacity 0.2s ease 0.15s',
          pointerEvents: isExpanded ? 'none' : 'auto',
        }}
      >
        <CurrentIcon size={13} strokeWidth={1.7} style={{ color: 'rgba(255,255,255,0.65)' }} />
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600 }}>
          {currentPanel.label}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {PANELS.map((panel) => (
            <div
              key={panel.id}
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: activePanel === panel.id ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
