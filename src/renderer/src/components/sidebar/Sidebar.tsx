import PanelRouter from './PanelRouter'
import IconStrip from './IconStrip'
import TitleBar from './TitleBar'
import AiSearchOverlay from './AiSearchOverlay'
import { usePetStore } from '@/stores/petStore'
import { windowApi } from '@/lib/ipc'
import GlobalToast from '@/components/common/GlobalToast'

export default function Sidebar() {
  const activePanel = usePetStore((s) => s.activePanel)

  return (
    <div
      className="flex flex-col overflow-hidden h-full"
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl)',
        background: 'rgba(28, 28, 30, 1)',
        border: '0.5px solid rgba(255,255,255,0.10)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 0.5px 0 rgba(255,255,255,0.06)',
        minWidth: 360,
      }}
    >
      {/* Title bar */}
      <TitleBar />

      {/* AI search overlay */}
      <AiSearchOverlay />

      {/* Content area: PanelRouter + IconStrip */}
      <div className="flex flex-1 min-h-0">
        <PanelRouter activePanel={activePanel} />
        <div style={{ width: 1, background: 'var(--separator)', flexShrink: 0 }} />
        <div
          className="w-[72px] shrink-0 flex flex-col items-center py-3"
          style={{ background: 'rgba(255,255,255,0.03)' }}
          onDoubleClick={() => windowApi.restoreDefault()}
        >
          <IconStrip activePanel={activePanel} />
        </div>
      </div>

      <GlobalToast />
    </div>
  )
}
