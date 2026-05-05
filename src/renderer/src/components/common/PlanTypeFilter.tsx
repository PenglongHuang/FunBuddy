import { motion } from 'motion/react'

export type PlanTypeFilterValue = 'all' | 'daily' | 'weekly' | 'monthly'

interface PlanTypeFilterProps {
  value: PlanTypeFilterValue
  onChange: (value: PlanTypeFilterValue) => void
}

const OPTIONS: Array<{ value: PlanTypeFilterValue; label: string; color: string }> = [
  { value: 'all', label: '全部', color: 'transparent' },
  { value: 'daily', label: '日', color: '#60a5fa' },
  { value: 'weekly', label: '周', color: '#c084fc' },
  { value: 'monthly', label: '月', color: '#fbbf24' },
]

function hexToRgb(hex: string): string {
  if (hex === 'transparent') return '0,0,0'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

export default function PlanTypeFilter({ value, onChange }: PlanTypeFilterProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value
        const rgb = hexToRgb(opt.color)
        return (
          <motion.button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            whileTap={{ scale: 0.96 }}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: isActive ? 500 : 400,
              borderLeft: `2px solid ${isActive ? opt.color : 'transparent'}`,
              background: isActive ? `rgba(${rgb},0.08)` : 'rgba(255,255,255,0.03)',
              color: isActive ? opt.color : '#aaa',
              cursor: 'pointer',
              transition: 'color 0.15s ease, background 0.15s ease, border-color 0.15s ease',
              outline: 'none',
              borderRight: 'none',
              borderTop: 'none',
              borderBottom: 'none',
            }}
          >
            {opt.label}
          </motion.button>
        )
      })}
    </div>
  )
}
