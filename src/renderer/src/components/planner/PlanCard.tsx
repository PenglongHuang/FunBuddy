import { useState } from 'react'
import type { Plan } from '@/types/plan'
import { formatFocusTime } from '@/lib/format-time'
import { TagBadge, MoreButton } from '@/components/ui'
import { highlightText } from '@/components/common/SearchBar'
import { motion } from 'motion/react'
import { Play, CheckSquare, Square, Calendar, CalendarDays, CalendarRange } from 'lucide-react'
import { useTimerStore } from '@/stores/timerStore'

// --- Helpers ---

function planIcon(plan: Plan) {
  const size = 14
  const color = plan.color
  switch (plan.planType) {
    case 'weekly':
      return <CalendarRange size={size} color={color} />
    case 'monthly':
      return <CalendarDays size={size} color={color} />
    default:
      return <Calendar size={size} color={color} />
  }
}

const typeGradients: Record<string, [string, string]> = {
  daily: ['#60a5fa', '#3b82f6'],
  weekly: ['#c084fc', '#a855f7'],
  monthly: ['#fbbf24', '#f59e0b'],
  neutral: ['#94a3b8', '#64748b'],
}

function getGradient(plan: Plan): [string, string] {
  return typeGradients[plan.planType] || typeGradients.neutral
}

function formatDateRangeFull(plan: Plan): string {
  const s = new Date(plan.startDate).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  if (!plan.endDate) return s
  const e = new Date(plan.endDate).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  return e !== s ? `${s} - ${e}` : s
}

function formatDateRange(plan: Plan): string {
  const s = new Date(plan.startDate)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  const start = fmt(s)
  if (!plan.endDate) return start
  const end = fmt(new Date(plan.endDate))
  return end !== start ? `${start} - ${end}` : start
}

// --- Props ---

interface PlanCardProps {
  plan: Plan
  viewMode: 'card' | 'compact'
  isActive: boolean
  isSelected: boolean
  editMode: boolean
  searchQuery?: string
  onFocusClick: (planId: string) => void
  onMoreClick: (planId: string, rect: DOMRect) => void
  onClick: (planId: string) => void
  onToggleSelect: (planId: string) => void
}

// --- Component ---

export default function PlanCard({
  plan,
  viewMode,
  isActive,
  isSelected,
  editMode,
  searchQuery,
  onFocusClick,
  onMoreClick,
  onClick,
  onToggleSelect,
}: PlanCardProps) {
  const [hovered, setHovered] = useState(false)
  const focusMin = useTimerStore((s) => s.getPlanFocusMinutes)(plan.id)
  const [startColor, endColor] = getGradient(plan)

  // --- Card mode ---
  if (viewMode === 'card') {
    const showActiveStyle = isActive
    const showHoverStyle = hovered && !editMode && !isActive

    const background = showActiveStyle
      ? 'rgba(255,255,255,0.06)'
      : showHoverStyle
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(255,255,255,0.03)'

    const borderColor = showActiveStyle
      ? 'rgba(255,255,255,0.10)'
      : showHoverStyle
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(255,255,255,0.06)'

    return (
      <motion.div
        onClick={() => {
          if (editMode) onToggleSelect(plan.id)
          else onClick(plan.id)
        }}
        whileTap={{ scale: 0.98 }}
        className="group"
        style={{
          background,
          border: isSelected
            ? '0.5px solid rgba(10,132,255,0.20)'
            : `0.5px solid ${borderColor}`,
          borderRadius: 12,
          padding: 12,
          cursor: 'pointer',
          transition: 'background 0.2s ease, border-color 0.2s ease',
          position: 'relative',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 3px gradient vertical indicator on left edge */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: `linear-gradient(180deg, ${startColor}, ${endColor})`,
            borderRadius: '12px 0 0 12px',
          }}
        />

        {/* Edit mode checkbox */}
        {editMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(plan.id) }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: isSelected ? 'var(--accent-blue)' : 'var(--text-quaternary)',
              transition: 'color 0.15s ease',
            }}
          >
            {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
          </button>
        )}

        {/* Title row: icon + title + right arrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {planIcon(plan)}
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#e5e5e7',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {searchQuery ? highlightText(plan.title, searchQuery) : plan.title}
          </span>
          {!editMode && (
            <span style={{ color: '#636366', fontSize: 14, flexShrink: 0 }}>{'›'}</span>
          )}
        </div>

        {/* Meta row: date + focus time + tags */}
        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#636366', marginBottom: 6 }}>
          <span>{'📅'} {formatDateRangeFull(plan)}</span>
          {focusMin > 0 && (
            <span style={{ color: '#30D158' }}>{'⏱'} {formatFocusTime(focusMin)}</span>
          )}
        </div>

        {/* Tags */}
        {(plan.tags ?? []).length > 0 && (
          <div style={{ display: 'flex' as const, gap: 4, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            {(plan.tags ?? []).slice(0, 3).map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {(plan.tags ?? []).length > 3 && (
              <span style={{ fontSize: 10, color: '#636366', lineHeight: '18px' }}>
                +{(plan.tags ?? []).length - 3}
              </span>
            )}
          </div>
        )}

        {/* Hover actions (non-edit mode) */}
        {!editMode && (
          <div
            className="flex items-center opacity-0 group-hover:opacity-100"
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              transition: 'opacity 0.15s ease',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFocusClick(plan.id)
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0A84FF',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 'var(--radius-sm)',
                transition: 'transform 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <Play size={14} fill="currentColor" />
            </button>
            <MoreButton
              onClick={(e) => {
                e.stopPropagation()
                onMoreClick(plan.id, e.currentTarget.getBoundingClientRect())
              }}
            />
          </div>
        )}
      </motion.div>
    )
  }

  // --- Compact mode ---
  const showActiveStyle = isActive
  const showHoverStyle = hovered && !editMode && !isActive && !isSelected

  const background = isSelected
    ? 'rgba(10,132,255,0.06)'
    : showActiveStyle
      ? 'rgba(255,255,255,0.06)'
      : showHoverStyle
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(255,255,255,0.03)'

  const borderColor = showActiveStyle
    ? 'rgba(255,255,255,0.10)'
    : showHoverStyle
      ? 'rgba(255,255,255,0.1)'
      : 'rgba(255,255,255,0.06)'

  return (
    <motion.div
      onClick={() => {
        if (editMode) onToggleSelect(plan.id)
        else onClick(plan.id)
      }}
      whileTap={{ scale: 0.98 }}
      style={{
        background,
        border: isSelected
          ? '0.5px solid rgba(10,132,255,0.20)'
          : `0.5px solid ${borderColor}`,
        borderRadius: 12,
        padding: 8,
        textAlign: 'center' as const,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 2.5px top color bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2.5,
          background: `linear-gradient(90deg, ${startColor}, ${endColor})`,
          borderRadius: '12px 12px 0 0',
        }}
      />

      {/* Edit mode checkbox or type icon */}
      {editMode ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(plan.id) }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: isSelected ? 'var(--accent-blue)' : 'var(--text-quaternary)',
            transition: 'color 0.15s ease',
          }}
        >
          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
        </button>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', color: plan.color }}>
          {planIcon(plan)}
        </div>
      )}

      <span style={{
        fontSize: 10,
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: '#e5e5e7',
      }}>
        {searchQuery ? highlightText(plan.title, searchQuery) : plan.title}
      </span>
      <span style={{ fontSize: 10, color: '#636366', marginTop: 2, display: 'block' }}>
        {formatDateRange(plan)}
      </span>
    </motion.div>
  )
}
