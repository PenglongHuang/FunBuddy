import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  allTags: string[]
  onUpdateTags: (tags: string[]) => void
  placeholder?: string
}

export default function TagInput({ tags, allTags, onUpdateTags, placeholder = '添加标签...' }: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
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
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 500,
            padding: '4px 8px',
            borderRadius: 8,
            background: 'transparent',
            color: '#8ab4f8',
            letterSpacing: 0.2,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(138,180,248,0.3)',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="3" fill="#8ab4f8" />
          </svg>
          {tag}
          <button
            onClick={() => removeTag(tag)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#555',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#888' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#555' }}
          >
            <X size={10} />
          </button>
        </span>
      ))}

      <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 60 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowSuggestions(true)
            setHighlightedIndex(-1)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (suggestions.length > 0) {
                setHighlightedIndex((prev) => (prev + 1) % suggestions.length)
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (suggestions.length > 0) {
                setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
              }
            } else if (e.key === 'Escape') {
              e.stopPropagation()
              setShowSuggestions(false)
              setHighlightedIndex(-1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (!input.trim()) {
                setShowSuggestions(false)
                setHighlightedIndex(-1)
                return
              }
              if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                addTag(suggestions[highlightedIndex])
              } else {
                addTag(input)
              }
            } else if (e.key === 'Backspace' && !input && tags.length > 0) {
              removeTag(tags[tags.length - 1])
            }
          }}
          placeholder={placeholder}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 11,
            color: 'var(--text-secondary)',
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
            {suggestions.map((tag, idx) => (
              <button
                key={tag}
                ref={(el) => {
                  if (idx === highlightedIndex && el) {
                    el.scrollIntoView({ block: 'nearest' })
                  }
                }}
                onClick={() => addTag(tag)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 10px',
                  background: idx === highlightedIndex ? 'rgba(138,180,248,0.15)' : 'transparent',
                  color: idx === highlightedIndex ? '#8ab4f8' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'var(--text-caption-1)',
                  textAlign: 'left',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onMouseLeave={() => setHighlightedIndex(-1)}
              >
                <svg width="10" height="10" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="3" fill="#8ab4f8" />
                </svg>
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
