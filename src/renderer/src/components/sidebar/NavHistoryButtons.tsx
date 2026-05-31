import { useState } from 'react'
import { useNavigationStore } from '@/stores/navigationStore'

export default function NavHistoryButtons() {
  const canBack = useNavigationStore((s) => s.canBack)
  const canForward = useNavigationStore((s) => s.canForward)
  const back = useNavigationStore((s) => s.back)
  const forward = useNavigationStore((s) => s.forward)
  const [backHovered, setBackHovered] = useState(false)
  const [fwdHovered, setFwdHovered] = useState(false)

  const btnStyle = (enabled: boolean, hovered: boolean): React.CSSProperties => ({
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    cursor: enabled ? 'pointer' : 'default',
    border: 'none',
    background: hovered && enabled ? 'rgba(255,255,255,0.1)' : 'transparent',
    opacity: enabled ? (hovered ? 0.8 : 0.5) : 0.15,
    transition: 'opacity 0.15s ease, background 0.15s ease',
    padding: 0,
  })

  const iconColor = (enabled: boolean) => enabled ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      <button
        onClick={back}
        disabled={!canBack}
        onMouseEnter={() => setBackHovered(true)}
        onMouseLeave={() => setBackHovered(false)}
        style={btnStyle(canBack, backHovered)}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M8 1L3 6L8 11" stroke={iconColor(canBack)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={forward}
        disabled={!canForward}
        onMouseEnter={() => setFwdHovered(true)}
        onMouseLeave={() => setFwdHovered(false)}
        style={btnStyle(canForward, fwdHovered)}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M4 1L9 6L4 11" stroke={iconColor(canForward)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
