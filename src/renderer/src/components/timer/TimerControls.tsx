import { useState, useCallback } from 'react'
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react'
import { motion } from 'motion/react'
import type { TimerStatus } from '@/types/timer'

interface TimerControlsProps {
  status: TimerStatus
  onPause: () => void
  onStart: () => void
  onResume: () => void
  onSkip: () => void
  onReset: () => void
}

export default function TimerControls({ status, onPause, onStart, onResume, onSkip, onReset }: TimerControlsProps) {
  const isRunning = status === 'running'
  const isIdle = status === 'idle'

  const handlePlayPause = useCallback(() => {
    if (isRunning) onPause()
    else if (isIdle) onStart()
    else onResume()
  }, [isRunning, isIdle, onPause, onStart, onResume])

  const primaryColor = isRunning ? 'var(--accent-blue)' : 'var(--accent-purple)'

  return (
    <div className="flex items-center justify-center gap-6">
      {/* Reset */}
      <motion.button
        onClick={onReset}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-full)',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          border: '1px solid var(--bg-tertiary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s ease, border-color 0.2s ease',
        }}
        title="重置"
      >
        <RotateCcw size={16} strokeWidth={1.8} />
      </motion.button>

      {/* Play / Pause — hero button */}
      <motion.button
        onClick={handlePlayPause}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--radius-full)',
          background: primaryColor,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 2px 16px ${isRunning ? 'rgba(10,132,255,0.35)' : 'rgba(191,90,242,0.35)'}`,
          transition: 'background 0.3s ease, box-shadow 0.3s ease',
        }}
        title={isRunning ? '暂停' : isIdle ? '开始专注' : '继续'}
      >
        {isRunning
          ? <Pause size={20} strokeWidth={2} />
          : <Play size={20} strokeWidth={2} style={{ marginLeft: 2 }} />}
      </motion.button>

      {/* Skip */}
      <motion.button
        onClick={onSkip}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-full)',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          border: '1px solid var(--bg-tertiary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s ease, border-color 0.2s ease',
        }}
        title="跳过"
      >
        <SkipForward size={16} strokeWidth={1.8} />
      </motion.button>
    </div>
  )
}
