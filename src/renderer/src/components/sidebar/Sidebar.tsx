import { motion, AnimatePresence } from 'motion/react'
import PanelRouter from './PanelRouter'
import IconStrip from './IconStrip'
import TitleBar from './TitleBar'
import { usePetStore } from '@/stores/petStore'
import { windowApi } from '@/lib/ipc'
import GlobalToast from '@/components/common/GlobalToast'

export default function Sidebar() {
  const activePanel = usePetStore((s) => s.activePanel)
  const setActivePanel = usePetStore((s) => s.setActivePanel)
  const tocVisible = usePetStore((s) => s.tocVisible)

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

      {/* Content area: PanelRouter + IconStrip */}
      <div className="flex flex-1 min-h-0">
        {/* Side panel slot (TOC renders here via portal) */}
        <AnimatePresence>
          {tocVisible && (
            <motion.div
              id="side-panel-slot"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 140, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ flexShrink: 0, overflow: 'hidden' }}
            />
          )}
        </AnimatePresence>
        {/* Left: Panel content */}
        <PanelRouter activePanel={activePanel} />

        {/* Divider */}
        <div style={{ width: 1, background: 'var(--separator)', flexShrink: 0 }} />

        {/* Right: icon rail (no pet avatar, no close button) */}
        <div
          className="w-[72px] shrink-0 flex flex-col items-center py-3"
          style={{
            background: 'rgba(255,255,255,0.03)',
          }}
          onDoubleClick={() => windowApi.restoreDefault()}
        >
          {/* Nav only */}
          <IconStrip activePanel={activePanel} onToggle={setActivePanel} />
        </div>
      </div>

      <GlobalToast />
    </div>
  )
}
