import { useState, useMemo, useRef, useEffect } from 'react'
import Dropdown from './Dropdown'
import type { TagWithCount } from '@/lib/tag-utils'

interface TagFilterDropdownProps {
  tags: TagWithCount[]
  activeTag: string | null
  onTagChange: (tag: string | null) => void
}

export default function TagFilterDropdown({ tags, activeTag, onTagChange }: TagFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setQuery('')
    if (open && searchInputRef.current) searchInputRef.current.focus()
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return tags
    const q = query.toLowerCase()
    return tags.filter((t) => t.name.toLowerCase().includes(q))
  }, [tags, query])

  const handleSelect = (tag: string) => {
    onTagChange(tag)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onTagChange(null)
  }

  return (
    <Dropdown
      trigger={
        activeTag !== null ? (
          <button
            onClick={() => setOpen((prev) => !prev)}
            style={{
              fontSize: 9,
              color: '#64D2FF',
              background: 'rgba(10,132,255,0.12)',
              border: '0.5px solid rgba(10,132,255,0.2)',
              borderRadius: 10,
              cursor: 'pointer',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              outline: 'none',
            }}
          >
            🏷 {activeTag}
            <span onClick={handleClear} style={{ cursor: 'pointer', opacity: 0.7, fontSize: 10, lineHeight: 1 }}>
              ✕
            </span>
          </button>
        ) : (
          <button
            onClick={() => setOpen((prev) => !prev)}
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
            🏷 标签 ▾
          </button>
        )
      }
      open={open}
      onClose={() => setOpen(false)}
    >
      <div style={{ width: 180 }}>
        {/* Search input */}
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索标签..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontSize: 11,
            padding: '4px 6px',
            borderRadius: 6,
            border: '0.5px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.06)',
            color: '#e5e5e7',
            outline: 'none',
            marginBottom: 4,
          }}
        />

        {/* Tag list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <span style={{ fontSize: 10, color: '#636366', padding: '4px 8px' }}>
              {query.trim() ? '未找到匹配的标签' : '暂无标签'}
            </span>
          )}
          {filtered.map((tag) => (
            <button
              key={tag.name}
              onClick={() => handleSelect(tag.name)}
              style={{
                fontSize: 11,
                color: activeTag === tag.name ? '#64D2FF' : '#ccc',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
                textAlign: 'left',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
            >
              <span>{tag.name}</span>
              <span style={{ fontSize: 9, color: '#636366', marginLeft: 8 }}>{tag.count}</span>
            </button>
          ))}
        </div>
      </div>
    </Dropdown>
  )
}
