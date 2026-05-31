import { lazy, Suspense } from 'react'
import GlassPanel from '@/components/common/GlassPanel'
import TabBar from '@/components/common/TabBar'
import { usePlanStore } from '@/stores/planStore'
import { useNoteStore } from '@/stores/noteStore'
import { Loader2 } from 'lucide-react'

const PlannerPanel = lazy(() => import('@/components/planner/PlannerPanel'))
const TimerPanel = lazy(() => import('@/components/timer/TimerPanel'))
const NotesPanel = lazy(() => import('@/components/notes/NotesPanel'))
const SettingsPanel = lazy(() => import('@/components/settings/SettingsPanel'))

const panelConfig: Record<string, { Component: React.ComponentType }> = {
  planner: { Component: PlannerPanel },
  timer: { Component: TimerPanel },
  notes: { Component: NotesPanel },
  settings: { Component: SettingsPanel },
}

interface PanelRouterProps {
  activePanel: string | null
}

function PlanTabBar({ activeTabId }: { activeTabId: string }) {
  const tabs = usePlanStore((s) => s.tabs)
  const store = usePlanStore.getState()
  return (
    <TabBar
      tabs={tabs}
      activeTabId={activeTabId}
      onSelect={store.switchTab}
      onClose={store.closeTab}
      onBeforeClose={() => true}
      onPin={store.pinTab}
      onReorder={store.reorderTabs}
      onCloseOthers={store.closeOtherTabs}
      onCloseUnpinned={store.closeUnpinnedTabs}
    />
  )
}

function NoteTabBar({ activeTabId }: { activeTabId: string }) {
  const tabs = useNoteStore((s) => s.tabs)
  const store = useNoteStore.getState()
  return (
    <TabBar
      tabs={tabs}
      activeTabId={activeTabId}
      onSelect={store.switchTab}
      onClose={store.closeTab}
      onBeforeClose={() => true}
      onPin={store.pinTab}
      onReorder={store.reorderTabs}
      onCloseOthers={store.closeOtherTabs}
      onCloseUnpinned={store.closeUnpinnedTabs}
    />
  )
}

export default function PanelRouter({ activePanel }: PanelRouterProps) {
  const planTabs = usePlanStore((s) => s.tabs)
  const planActiveTabId = usePlanStore((s) => s.activeTabId)
  const noteTabs = useNoteStore((s) => s.tabs)
  const noteActiveTabId = useNoteStore((s) => s.activeTabId)

  if (!activePanel) return null

  const config = panelConfig[activePanel]
  if (!config) return null

  const showPlanTabs = activePanel === 'planner' && planTabs.length > 0 && planActiveTabId
  const showNoteTabs = activePanel === 'notes' && noteTabs.length > 0 && noteActiveTabId

  return (
    <div className="flex-1 overflow-hidden" style={{ minWidth: 280, containerType: 'inline-size' }}>
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 size={16} className="text-white/30 animate-spin" />
        </div>
      }>
        <GlassPanel header={
          showPlanTabs ? <PlanTabBar activeTabId={planActiveTabId} /> :
          showNoteTabs ? <NoteTabBar activeTabId={noteActiveTabId} /> :
          undefined
        }>
          <config.Component />
        </GlassPanel>
      </Suspense>
    </div>
  )
}
