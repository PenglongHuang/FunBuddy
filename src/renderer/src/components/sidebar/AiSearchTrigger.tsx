import { useState } from 'react'
import { useNavigationStore } from '@/stores/navigationStore'

export default function AiSearchTrigger() {
  const toggleAiSearch = useNavigationStore((s) => s.toggleAiSearch)
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={toggleAiSearch}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered
          ? 'linear-gradient(135deg, rgba(0,122,255,0.25), rgba(175,82,222,0.25))'
          : 'linear-gradient(135deg, rgba(0,122,255,0.15), rgba(175,82,222,0.15))',
        transition: 'background 0.2s ease',
        padding: 0,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>✨</span>
    </button>
  )
}
