import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { getTagColor } from '@/lib/tag-utils'

interface TagInputProps {
  tags: string[]
  allTags: string[]
  onUpdateTags: (tags: string[]) => void
  placeholder?: string
}

export default function TagInput({ tags, allTags, onUpdateTags, placeholder = '添加标签...' }: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = allTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase()),
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || tags.includes(trimmed)) return
    onUpdateTags([...tags, trimmed])
    setInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeTag = (tag: string) => {
    onUpdateTags(tags.filter((t) => t !== tag))
  }

  return (
    <div
      ref={wrapperRef}
      className="flex flex-wrap items-center gap-1.5"
      style={{ position: 'relative', padding: '4px 0' }}
    >
      {tags.map((tag) => {
        const color = getTagColor(tag)
        return (
          <span
            key={tag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px 2px 8px',
              borderRadius: 'var(--radius-full)',
              background: `${color}20`,
              color,
              letterSpacing: 0.2,
              whiteSpace: 'nowrap',
            }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                opacity: 0.6,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
            >
              <X size={10} />
            </button>
          </span>
        )
      })}

      <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 60 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(input)
            } else if (e.key === 'Backspace' && !input && tags.length > 0) {
              removeTag(tags[tags.length - 1])
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            font: 'var(--text-caption-1)',
            color: 'var(--text-primary)',
            width: '100%',
            minWidth: 60,
          }}
        />

        {showSuggestions && input && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 20,
              background: 'var(--bg-secondary)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: 'var(--radius-sm)',
              marginTop: 4,
              maxHeight: 120,
              overflowY: 'auto',
              minWidth: 120,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            {suggestions.map((tag) => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'var(--text-caption-1)',
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: getTagColor(tag), flexShrink: 0 }} />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
