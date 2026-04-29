import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { TimerPhase, TimerStatus } from '@/types/timer'
import { formatTime } from '@/lib/time-utils'

interface TimerRingProps {
  phase: TimerPhase
  remainingMs: number
  totalMs: number
  round: number
  status?: TimerStatus
}

const PHASE_COLORS: Record<TimerPhase, string> = {
  focus: '#FF9F0A',
  shortBreak: '#64D2FF',
  longBreak: '#30D158',
}

const PHASE_LABELS: Record<TimerPhase, string> = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息',
}

export default function TimerRing({ phase, remainingMs, totalMs, round, status }: TimerRingProps) {
  const progress = totalMs > 0 ? Math.max(0, 1 - remainingMs / totalMs) : 0
  const isRunning = status === 'running'
  const color = PHASE_COLORS[phase]

  const size = 180
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  const gradId = useMemo(() => `rg-${Math.random().toString(36).slice(2, 9)}`, [])

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{ filter: isRunning ? `drop-shadow(0 0 10px ${color}40)` : 'none', transition: 'filter 0.5s ease' }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--bg-tertiary)"
            strokeWidth={stroke}
          />

          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>

        {/* Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            style={{
              font: 'var(--text-title-1)',
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
            key={remainingMs}
            initial={{ opacity: 0.7, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {formatTime(remainingMs)}
          </motion.span>
          <span
            style={{
              font: 'var(--text-caption-1)',
              color: 'var(--text-tertiary)',
              marginTop: 6,
            }}
          >
            {round > 0 ? `第 ${round} 轮 · ${PHASE_LABELS[phase]}` : PHASE_LABELS[phase]}
          </span>
        </div>
      </div>

      {/* Phase pills */}
      <div className="flex gap-1.5">
        {(Object.keys(PHASE_COLORS) as TimerPhase[]).map((p) => {
          const active = p === phase
          return (
            <span
              key={p}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 11,
                fontWeight: 500,
                background: active ? `${PHASE_COLORS[p]}20` : 'transparent',
                color: active ? PHASE_COLORS[p] : 'var(--text-quaternary)',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {active && (
                <motion.span
                  style={{ width: 5, height: 5, borderRadius: '50%', background: PHASE_COLORS[p] }}
                  animate={isRunning ? { opacity: [1, 0.4, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {PHASE_LABELS[p]}
            </span>
          )
        })}
      </div>
    </div>
  )
}
