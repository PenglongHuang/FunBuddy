import { useState, type ChangeEvent } from 'react'

interface SearchBarProps {
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export default function SearchBar({ placeholder, value, onChange }: SearchBarProps) {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0

  return (
    <div
      style={{
        margin: '4px 12px 2px',
        padding: '5px 10px',
        background: active ? 'rgba(10,132,255,0.04)' : 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: active
          ? '0.5px solid rgba(10,132,255,0.3)'
          : '0.5px solid rgba(255,255,255,0.06)',
        transition: 'border-color 0.2s ease, background 0.2s ease',
      }}
    >
      <span style={{ fontSize: 11, color: active ? '#64D2FF' : '#48484a' }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 11,
          color: '#e5e5e7',
          flex: 1,
          fontFamily: 'inherit',
        }}
      />
      {value.length > 0 && (
        <div
          onClick={() => onChange('')}
          style={{
            fontSize: 9,
            color: '#636366',
            cursor: 'pointer',
            width: 15,
            height: 15,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ✕
        </div>
      )}
    </div>
  )
}

export function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const q = query.toLowerCase()
  const lower = text.toLowerCase()
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let idx = lower.indexOf(q, lastIdx)
  let key = 0
  while (idx !== -1) {
    if (idx > lastIdx) parts.push(text.slice(lastIdx, idx))
    parts.push(
      <span key={key++} style={{ color: '#64D2FF', background: 'rgba(10,132,255,0.15)', padding: '0 2px', borderRadius: 2 }}>
        {text.slice(idx, idx + q.length)}
      </span>
    )
    lastIdx = idx + q.length
    idx = lower.indexOf(q, lastIdx)
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts.length > 0 ? <>{parts}</> : text
}
