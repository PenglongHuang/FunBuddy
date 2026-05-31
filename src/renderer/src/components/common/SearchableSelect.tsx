import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react'
import Dropdown from './Dropdown'

export interface SearchableSelectItem {
  value: string
  label: string
  icon?: ReactNode
}

interface SearchableSelectProps {
  items: SearchableSelectItem[]
  value: string | null
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  onChange: (value: string | null) => void
  width?: number
}

export default function SearchableSelect({
  items,
  value,
  placeholder = '请选择',
  searchPlaceholder = '搜索...',
  emptyText = '未找到匹配项',
  onChange,
  width = 200,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [items, query])

  const selectedItem = items.find((item) => item.value === value) ?? null

  const handleSelect = (itemValue: string) => {
    onChange(itemValue)
    setOpen(false)
  }

  return (
    <Dropdown
      trigger={
        <button
          onClick={() => setOpen((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.06)',
            border: open ? '1px solid rgba(255,159,10,0.3)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
        >
          {selectedItem?.icon}
          <span style={{ flex: 1, textAlign: 'left', color: selectedItem ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            {selectedItem?.label ?? placeholder}
          </span>
          <span style={{ color: 'var(--text-quaternary)', fontSize: 10 }}>
            {open ? '▲' : '▼'}
          </span>
        </button>
      }
      open={open}
      onClose={() => setOpen(false)}
    >
      <div style={{ width }}>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontSize: 11,
            padding: '5px 8px',
            borderRadius: 6,
            border: '0.5px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-primary)',
            outline: 'none',
            marginBottom: 4,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 180, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-quaternary)', padding: '6px 8px' }}>
              {emptyText}
            </span>
          )}
          {filtered.map((item) => {
            const isSelected = item.value === value
            return (
              <button
                key={item.value}
                onClick={() => handleSelect(item.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  fontSize: 11,
                  color: isSelected ? '#FF9F0A' : 'var(--text-secondary)',
                  background: 'none',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  outline: 'none',
                  width: '100%',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {isSelected && <span style={{ fontSize: 12, flexShrink: 0 }}>✓</span>}
              </button>
            )
          })}
        </div>
      </div>
    </Dropdown>
  )
}
