import { useEffect } from 'react'
import { usePlanStore } from '@/stores/planStore'
import { useNavigationStore } from '@/stores/navigationStore'
import PlanList from './PlanList'
import CalendarView from './CalendarView'
import PlanEditor from './PlanEditor'

export default function PlannerPanel() {
  const load = usePlanStore((s) => s.load)
  const tabs = usePlanStore((s) => s.tabs)
  const activeTabId = usePlanStore((s) => s.activeTabId)
  const plannerView = usePlanStore((s) => s.plannerView)
  const navPush = useNavigationStore((s) => s.push)

  useEffect(() => { load() }, [load])

  // Calendar view: no tabs, same as before
  if (!activeTabId && plannerView === 'calendar') {
    return <CalendarView onSwitchView={(mode) => {
      usePlanStore.getState().setViewMode(mode)
      navPush({ panel: 'planner', subView: 'list' })
    }} />
  }

  // Editor view (TabBar rendered by PanelRouter as GlassPanel header)
  if (tabs.length > 0 && activeTabId) {
    return <PlanEditor planId={activeTabId} />
  }

  // Empty state: show list
  return <PlanList />
}
