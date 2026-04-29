import { useEffect } from 'react'
import { motion } from 'motion/react'
import TimerRing from './TimerRing'
import TimerControls from './TimerControls'
import { useTimerStore } from '@/stores/timerStore'

export default function TimerPanel() {
  const timer = useTimerStore((s) => s)

  useEffect(() => {
    timer._loadPersisted()
    timer._loadHistory()
  }, [timer._loadPersisted, timer._loadHistory])

  return (
    <div className="flex flex-col items-center gap-5">
      <TimerRing
        phase={timer.phase}
        remainingMs={timer.remainingMs}
        totalMs={timer.totalMs}
        round={timer.round}
        status={timer.status}
      />

      <TimerControls
        status={timer.status}
        onPause={() => timer.pause()}
        onStart={() => timer.start()}
        onResume={() => timer.resume()}
        onSkip={() => timer.skip()}
        onReset={() => timer.reset()}
      />

      {/* Today stats */}
      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginTop: 4,
        }}
      >
        <StatCard
          value={timer.todayCount}
          label="完成轮数"
          color="var(--accent-orange)"
          bgColor="rgba(255,159,10,0.10)"
        />
        <StatCard
          value={timer.todayMinutes}
          label="专注分钟"
          color="var(--accent-blue)"
          bgColor="rgba(10,132,255,0.10)"
        />
      </motion.div>
    </div>
  )
}

function StatCard({ value, label, color, bgColor }: {
  value: number
  label: string
  color: string
  bgColor: string
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        background: bgColor,
        border: '0.5px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ font: 'var(--text-title-3)', color, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      <div style={{ font: 'var(--text-caption-1)', color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
    </div>
  )
}
