import { useState, useMemo, useCallback } from 'react'
import Dropdown from '@/components/common/Dropdown'
import TagFilterDropdown from '@/components/common/TagFilterDropdown'
import { getTagsWithCounts } from '@/lib/tag-utils'
import type { Plan } from '@/types/plan'
import type { PlanTypeFilterValue } from '@/components/common/PlanTypeFilter'

interface PlanToolbarProps {
  plans: Plan[]
  planTypeFilter: PlanTypeFilterValue
  onPlanTypeFilterChange: (value: PlanTypeFilterValue) => void
  activeFilterTag: string | null
  onActiveFilterTagChange: (tag: string | null) => void
  sortBy: 'time' | 'name' | 'planDate'
  onSortByChange: (sort: 'time' | 'name' | 'planDate') => void
  viewMode: 'card' | 'compact' | 'calendar'
  onViewModeChange: (mode: 'card' | 'compact' | 'calendar') => void
  editMode: boolean
}

const TYPE_OPTIONS: Array<{ value: PlanTypeFilterValue; label: string; color: string }> = [
  { value: 'all', label: '全部', color: '#64D2FF' },
  { value: 'daily', label: '日计划', color: '#60a5fa' },
  { value: 'weekly', label: '周计划', color: '#c084fc' },
  { value: 'monthly', label: '月计划', color: '#fbbf24' },
]

const SORT_OPTIONS: Array<{ value: 'time' | 'name' | 'planDate'; label: string }> = [
  { value: 'time', label: '时间' },
  { value: 'name', label: '名称' },
  { value: 'planDate', label: '计划日期' },
]

const VIEW_MODES: Array<{ value: 'card' | 'compact' | 'calendar'; icon: string }> = [
  { value: 'card', icon: '☰' },
  { value: 'compact', icon: '⊞' },
  { value: 'calendar', icon: '📅' },
]

export default function PlanToolbar({
  plans,
  planTypeFilter,
  onPlanTypeFilterChange,
  activeFilterTag,
  onActiveFilterTagChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  editMode,
}: PlanToolbarProps) {
  const [typeOpen, setTypeOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  const tagItems = useMemo(() => getTagsWithCounts(plans), [plans])

  const currentTypeLabel = TYPE_OPTIONS.find((o) => o.value === planTypeFilter)?.label ?? '全部'
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? '时间'

  const handleTypeSelect = useCallback(
    (value: PlanTypeFilterValue) => {
      onPlanTypeFilterChange(value)
      setTypeOpen(false)
    },
    [onPlanTypeFilterChange],
  )

  const handleSortSelect = useCallback(
    (value: 'time' | 'name' | 'planDate') => {
      onSortByChange(value)
      setSortOpen(false)
    },
    [onSortByChange],
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Type filter dropdown */}
      {!editMode && (
        <Dropdown
          trigger={
            <button
              onClick={() => setTypeOpen((prev) => !prev)}
              style={{
                fontSize: 9,
                color: '#8e8e93',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '3px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                outline: 'none',
              }}
            >
              ▾ {currentTypeLabel}
            </button>
          }
          open={typeOpen}
          onClose={() => setTypeOpen(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleTypeSelect(opt.value)}
                style={{
                  fontSize: 11,
                  color: planTypeFilter === opt.value ? '#64D2FF' : '#ccc',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  textAlign: 'left',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: opt.color,
                    flexShrink: 0,
                  }}
                />
                {planTypeFilter === opt.value ? '✓ ' : ''}
                {opt.label}
              </button>
            ))}
          </div>
        </Dropdown>
      )}

      {/* Tag dropdown */}
      {!editMode && (
        <TagFilterDropdown
          tags={tagItems}
          activeTag={activeFilterTag}
          onTagChange={onActiveFilterTagChange}
        />
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Sort + View toggle — hidden in edit mode */}
      {!editMode && (
        <>
          {/* Sort dropdown */}
          <Dropdown
            trigger={
              <button
                onClick={() => setSortOpen((prev) => !prev)}
                style={{
                  fontSize: 9,
                  color: '#8e8e93',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  outline: 'none',
                }}
              >
                ↓ {currentSortLabel} ▾
              </button>
            }
            open={sortOpen}
            onClose={() => setSortOpen(false)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSortSelect(opt.value)}
                  style={{
                    fontSize: 11,
                    color: sortBy === opt.value ? '#64D2FF' : '#ccc',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 6,
                    textAlign: 'left',
                    outline: 'none',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  {sortBy === opt.value ? '✓ ' : ''}
                  {opt.label}
                </button>
              ))}
            </div>
          </Dropdown>

          {/* View toggle — far right */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              padding: 2,
            }}
          >
            {VIEW_MODES.map((mode) => {
              const isActive = viewMode === mode.value
              return (
                <button
                  key={mode.value}
                  onClick={() => onViewModeChange(mode.value)}
                  style={{
                    padding: '3px 6px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive
                      ? 'rgba(10,132,255,0.2)'
                      : 'transparent',
                    color: isActive ? '#64D2FF' : '#636366',
                    fontSize: 11,
                    outline: 'none',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  {mode.icon}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
