import { useState, useMemo, useCallback } from 'react'
import Dropdown from '@/components/common/Dropdown'
import TagFilterDropdown from '@/components/common/TagFilterDropdown'
import { getTagsWithCounts } from '@/lib/tag-utils'
import type { Note } from '@/types/note'

interface NoteToolbarProps {
  notes: Note[]
  activeFilterTag: string | null
  onActiveFilterTagChange: (tag: string | null) => void
  sortBy: 'time' | 'name'
  onSortByChange: (sort: 'time' | 'name') => void
  viewMode: 'card' | 'compact'
  onViewModeChange: (mode: 'card' | 'compact') => void
  editMode: boolean
}

const SORT_OPTIONS: Array<{ value: 'time' | 'name'; label: string }> = [
  { value: 'time', label: '时间' },
  { value: 'name', label: '名称' },
]

const VIEW_MODES: Array<{ value: 'card' | 'compact'; icon: string }> = [
  { value: 'card', icon: '☰' },
  { value: 'compact', icon: '⊞' },
]

export default function NoteToolbar({
  notes,
  activeFilterTag,
  onActiveFilterTagChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  editMode,
}: NoteToolbarProps) {
  const [sortOpen, setSortOpen] = useState(false)

  const tagItems = useMemo(() => getTagsWithCounts(notes), [notes])

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? '时间'

  const handleSortSelect = useCallback(
    (value: 'time' | 'name') => {
      onSortByChange(value)
      setSortOpen(false)
    },
    [onSortByChange],
  )

  // Entire toolbar hidden during edit mode
  if (editMode) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 28,
        gap: 8,
      }}
    >
      {/* Tag dropdown — leftmost */}
      <TagFilterDropdown
        tags={tagItems}
        activeTag={activeFilterTag}
        onTagChange={onActiveFilterTagChange}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Sort dropdown — before view toggle */}
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
    </div>
  )
}
