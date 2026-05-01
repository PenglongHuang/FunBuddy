import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import TimerRing from './TimerRing'
import TimerControls from './TimerControls'
import FocusStartDialog from './FocusStartDialog'
import TimerHistoryPanel from './TimerHistoryPanel'
import { useTimerStore } from '@/stores/timerStore'

export default function TimerPanel() {
  const timer = useTimerStore((s) => s)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [showHistory, setShowHistory] = useState(true)

  useEffect(() => {
    timer._loadPersisted()
    timer._loadHistory()
  }, [timer._loadPersisted, timer._loadHistory])

  const handleStart = () => {
    if (timer.phase === 'focus') {
      setShowStartDialog(true)
    } else {
      timer.start()
    }
  }

  const handleStartWithoutPlan = () => {
    setShowStartDialog(false)
    timer.start()
  }

  return (
    <div className="flex flex-col h-full gap-4" style={{ overflowY: 'auto' }}>
      {/* History panel (top) */}
      <div
        onClick={() => setShowHistory(!showHistory)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '0 2px' }}
      >
        <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-tertiary)', fontWeight: 500 }}>专注记录</span>
        <span style={{ font: 'var(--text-caption-2)', color: 'var(--text-quaternary)' }}>{showHistory ? '收起 ▲' : '展开 ▼'}</span>
      </div>
      {showHistory && <TimerHistoryPanel />}

      {/* Divider */}
      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }} />

      {/* Timer area (bottom) */}
      <div className="flex flex-col items-center gap-4">
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
          onStart={handleStart}
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
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          <StatCard value={timer.todayCount} label="完成轮数" color="var(--accent-teal)" bgColor="rgba(100,210,255,0.10)" />
          <StatCard value={timer.todayMinutes} label="专注分钟" color="var(--accent-blue)" bgColor="rgba(10,132,255,0.10)" />
        </motion.div>
      </div>

      {showStartDialog && (
        <FocusStartDialog
          onCancel={() => setShowStartDialog(false)}
          onStartWithoutPlan={handleStartWithoutPlan}
        />
      )}
    </div>
  )
}

function StatCard({ value, label, color, bgColor }: { value: number; label: string; color: string; bgColor: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: bgColor, border: '0.5px solid rgba(255,255,255,0.06)' }}>
      <div style={{ font: 'var(--text-title-3)', color, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      <div style={{ font: 'var(--text-caption-1)', color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
    </div>
  )
}
