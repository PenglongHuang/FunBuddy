import { useState } from 'react'
import DynamicIsland from './DynamicIsland'
import TrafficLights from './TrafficLights'
import NavHistoryButtons from './NavHistoryButtons'
import AiSearchTrigger from './AiSearchTrigger'
import { usePetStore } from '@/stores/petStore'

export default function TitleBar() {
  const setWindowMode = usePetStore((s) => s.setWindowMode)
  const isPinned = usePetStore((s) => s.isPinned)
  const togglePinned = usePetStore((s) => s.togglePinned)
  const [petHovered, setPetHovered] = useState(false)
  const [pinHovered, setPinHovered] = useState(false)

  const iconBtnStyle = (hovered: boolean, active?: boolean): React.CSSProperties => ({
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    cursor: 'pointer',
    border: 'none',
    background: hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
    opacity: active || hovered ? 0.7 : 0.35,
    transition: 'opacity 0.15s ease, background 0.15s ease',
    padding: 0,
  })

  return (
    <div
      style={{
        height: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        background: 'rgba(28, 28, 30, 1)',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        borderRadius: '16px 16px 0 0',
        WebkitAppRegion: 'drag',
        position: 'relative',
      }}
    >
      {/* Left group — absolute */}
      <div style={{ WebkitAppRegion: 'no-drag', position: 'absolute', left: 14, display: 'flex', gap: 0 }}>
        <button
          onClick={() => setWindowMode('pet')}
          onMouseEnter={() => setPetHovered(true)}
          onMouseLeave={() => setPetHovered(false)}
          title="收起为宠物模式"
          style={iconBtnStyle(petHovered)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
        <button
          onClick={togglePinned}
          onMouseEnter={() => setPinHovered(true)}
          onMouseLeave={() => setPinHovered(false)}
          title={isPinned ? '取消置顶' : '窗口置顶'}
          style={iconBtnStyle(pinHovered, isPinned)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </button>
      </div>

      {/* Center group — margin: 0 auto */}
      <div style={{ WebkitAppRegion: 'no-drag', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <NavHistoryButtons />
        <DynamicIsland />
        <AiSearchTrigger />
      </div>

      {/* Right group — absolute */}
      <div style={{ WebkitAppRegion: 'no-drag', position: 'absolute', right: 14 }}>
        <TrafficLights />
      </div>
    </div>
  )
}
