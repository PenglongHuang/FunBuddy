import { useId, useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { usePetStore } from '@/stores/petStore'
import type { PetState, HoverAnimation } from '@/types/pet'
import type { TimerPhase } from '@/types/timer'
import {
  pickRandomHover,
  containerVariants,
  containerTransition,
  bodyVariants,
  wiggleTransition,
} from './hoverAnimations'
import { useTimerStore } from '@/stores/timerStore'
import { windowApi } from '@/lib/ipc'
import { formatTime } from '@/lib/time-utils'

const STAR_PATH = 'M122 52Q128 40 134 52L155 95L204 99Q218 100 208 109L172 142L182 191Q185 205 172 197L128 170L84 197Q71 205 74 191L84 142L48 109Q38 100 52 99L101 95Z'

interface PetAvatarProps {
  size?: number
  onClick?: () => void
  className?: string
  showTimer?: boolean
}

export default function PetAvatar({ size = 100, onClick, className = '', showTimer = true }: PetAvatarProps) {
  const state = usePetStore((s) => s.state)
  const touch = usePetStore((s) => s.touch)
  const petHovered = usePetStore((s) => s.petHovered)
  const timerStatus = useTimerStore((s) => s.status)
  const isTimerRunning = timerStatus === 'running'
  const [hoverAnim, setHoverAnim] = useState<HoverAnimation | null>(null)
  const [isMouseOver, setIsMouseOver] = useState(false)

  useEffect(() => {
    if (isTimerRunning) windowApi.invalidate()
  }, [isTimerRunning])
  const [isBlinking, setIsBlinking] = useState(false)
  const lastHoverAnimRef = useRef<HoverAnimation | null>(null)
  const spinDirectionRef = useRef<'spin' | 'spinCCW'>('spin')
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uid = useId().replace(/:/g, '')
  const gradId = `starGrad-${uid}`
  const shadowId = `starShadow-${uid}`
  const shadowHoverId = `starShadowH-${uid}`
  const displayState = state

  // Periodic blink when eyes are open
  useEffect(() => {
    if (displayState !== 'smile') {
      setIsBlinking(false)
      return
    }

    let cancelled = false

    const scheduleNext = () => {
      if (cancelled) return
      const delay = 3000 + Math.random() * 3000
      blinkTimeoutRef.current = setTimeout(() => {
        if (cancelled) return
        setIsBlinking(true)
        blinkTimeoutRef.current = setTimeout(() => {
          if (!cancelled) {
            setIsBlinking(false)
            scheduleNext()
          }
        }, 150)
      }, delay)
    }

    scheduleNext()

    return () => {
      cancelled = true
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current)
    }
  }, [displayState])

  const handleMouseEnter = useCallback(() => {
    setIsMouseOver(true)
    const pick = pickRandomHover(lastHoverAnimRef.current)
    lastHoverAnimRef.current = pick
    if (pick === 'spin') {
      spinDirectionRef.current = Math.random() > 0.5 ? 'spin' : 'spinCCW'
    }
    setHoverAnim(pick)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsMouseOver(false)
    setHoverAnim(null)
  }, [])

  // Store-based hover trigger for pet mode (React onMouseEnter doesn't fire
  // when the window uses setIgnoreMouseEvents with forward mode)
  useEffect(() => {
    setIsMouseOver(petHovered)
    if (petHovered) {
      const pick = pickRandomHover(lastHoverAnimRef.current)
      lastHoverAnimRef.current = pick
      if (pick === 'spin') {
        spinDirectionRef.current = Math.random() > 0.5 ? 'spin' : 'spinCCW'
      }
      setHoverAnim(pick)
    } else {
      setHoverAnim(null)
    }
  }, [petHovered])

  const handleAnimComplete = useCallback(() => {
    setHoverAnim(null)
  }, [])

  const activeBodyVariant = hoverAnim
    ? hoverAnim === 'spin'
      ? spinDirectionRef.current
      : hoverAnim
    : 'wiggle'

  const isHovered = hoverAnim !== null
  const showTimerBubble = showTimer && isTimerRunning && (isMouseOver || petHovered)

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size, cursor: 'pointer', userSelect: 'none', position: 'relative', overflow: 'visible' }}
      variants={containerVariants}
      animate={isHovered ? 'hovered' : 'idle'}
      transition={containerTransition}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => { touch(); onClick?.() }}
    >
      <motion.div
        variants={bodyVariants}
        animate={activeBodyVariant}
        transition={hoverAnim ? undefined : wiggleTransition}
        onAnimationComplete={hoverAnim ? handleAnimComplete : undefined}
        style={{ width: '100%', height: '100%', transformOrigin: 'center center' }}
      >
        <svg viewBox="0 0 256 256" width={size} height={size}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF8E7" />
              <stop offset="50%" stopColor="#FFE082" />
              <stop offset="100%" stopColor="#FFD54F" />
            </linearGradient>
            <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#000" floodOpacity="0.2" />
            </filter>
            <filter id={shadowHoverId} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="10" floodColor="#FFD54F" floodOpacity="0.4" />
            </filter>
          </defs>

          <path
            d={STAR_PATH}
            fill={`url(#${gradId})`}
            filter={`url(#${isHovered ? shadowHoverId : shadowId})`}
            stroke="#FFD54F"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {renderEyes(displayState, isBlinking)}

          {hoverAnim === 'think' && !isTimerRunning && <ThoughtBubble />}

          {hoverAnim === 'heart' && <HeartOverlay />}
        </svg>
      </motion.div>
      <AnimatePresence>
        {showTimerBubble && (
          <FocusBubble size={size} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ThoughtBubble() {
  return (
    <motion.g
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: [0, 1, 1, 0], y: [5, 0, -3, -8] }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      <ellipse
        cx={128} cy={18} rx={22} ry={14}
        fill="rgba(255,255,255,0.85)"
        stroke="rgba(255,213,79,0.6)"
        strokeWidth={1.5}
      />
      <circle cx={120} cy={38} r={4} fill="rgba(255,255,255,0.75)" />
      <circle cx={116} cy={48} r={2.5} fill="rgba(255,255,255,0.6)" />
      <text
        x={128} y={23}
        textAnchor="middle"
        fontSize={14}
        fill="#5D4037"
        fontWeight="bold"
      >
        {'···'}
      </text>
    </motion.g>
  )
}

function HeartOverlay() {
  return (
    <motion.g
      initial={{ opacity: 0, y: 10, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: [10, -5, -20, -35], scale: [0.5, 1, 1.1, 0.8] }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      style={{ transformOrigin: '140px 40px' }}
    >
      <path
        d="M140 48 C140 48, 130 38, 130 34 C130 30, 134 28, 137 28 C139 28, 140 30, 140 32 C140 30, 141 28, 143 28 C146 28, 150 30, 150 34 C150 38, 140 48, 140 48Z"
        fill="#FF6B8A"
        opacity={0.9}
      />
    </motion.g>
  )
}

const PHASE_COLORS: Record<TimerPhase, { stroke: string; bg: string; text: string }> = {
  focus: { stroke: '#FFD54F', bg: 'rgba(255,213,79,0.25)', text: '#5D4037' },
  shortBreak: { stroke: '#64B5F6', bg: 'rgba(100,181,246,0.25)', text: '#37474F' },
  longBreak: { stroke: '#81C784', bg: 'rgba(129,199,132,0.25)', text: '#2E4A2E' },
}

function FocusBubble({ size }: { size: number }) {
  const remainingMs = useTimerStore((s) => s.remainingMs)
  const totalMs = useTimerStore((s) => s.totalMs)
  const phase = useTimerStore((s) => s.phase)
  const progress = totalMs > 0 ? remainingMs / totalMs : 1
  const timeStr = formatTime(remainingMs)
  const R = 17
  const C = 2 * Math.PI * R
  const dashOffset = C * (1 - progress)
  const above = size > 60
  const ringPx = above ? 44 : 34
  const cx = 26
  const vb = cx * 2
  const colors = PHASE_COLORS[phase]

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        ...(above
          ? { bottom: '100%', marginBottom: -4 }
          : { top: '100%', marginTop: -2 }),
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: above ? 5 : -5, scale: 0.85 }}
        animate={{ opacity: 1, y: [0, above ? -3 : 2, 0], scale: 1 }}
        exit={{ opacity: 0, y: above ? 5 : -5, scale: 0.85 }}
        transition={{
          opacity: { duration: 0.25 },
          scale: { duration: 0.25 },
          y: { duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' as const },
        }}
      >
        <svg width={ringPx} height={ringPx} viewBox={`0 0 ${vb} ${vb}`} overflow="visible">
          <circle
            cx={cx} cy={cx} r={R}
            fill="rgba(255,255,255,0.88)"
            stroke={colors.bg}
            strokeWidth={3.5}
          />
          <circle
            cx={cx} cy={cx} r={R}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cx})`}
            style={{ transition: 'stroke-dashoffset 0.5s linear' }}
          />
          <text
            x={cx} y={cx + 4}
            textAnchor="middle"
            fontSize={10}
            fill={colors.text}
            fontWeight={600}
          >
            {timeStr}
          </text>
        </svg>
      </motion.div>
    </div>
  )
}

function renderEyes(state: PetState, isBlinking: boolean) {
  const closedEyes = (
    <>
      <line x1="94" y1="126" x2="118" y2="126" stroke="#5D4037" strokeWidth="4" strokeLinecap="round" />
      <line x1="138" y1="126" x2="162" y2="126" stroke="#5D4037" strokeWidth="4" strokeLinecap="round" />
    </>
  )

  if (state === 'sleep' || (isBlinking && state === 'smile')) {
    return closedEyes
  }

  if (state === 'singleWink') {
    return (
      <>
        <path d="M94 128 Q106 116 118 128" stroke="#5D4037" strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="150" cy="126" rx="10" ry="12" fill="#5D4037" />
        <circle cx="153" cy="123" r="3.5" fill="rgba(255,255,255,0.55)" />
      </>
    )
  }

  if (state === 'doubleWink') {
    return (
      <>
        <path d="M94 128 Q106 114 118 128" stroke="#5D4037" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M138 128 Q150 114 162 128" stroke="#5D4037" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    )
  }

  return (
    <>
      <ellipse cx="108" cy="126" rx="11" ry="13" fill="#5D4037" />
      <ellipse cx="148" cy="126" rx="11" ry="13" fill="#5D4037" />
      <circle cx="111" cy="122" r="4" fill="rgba(255,255,255,0.55)" />
      <circle cx="151" cy="122" r="4" fill="rgba(255,255,255,0.55)" />
    </>
  )
}
