import type { Tab } from '@/types/tab'

export interface TabSnapshot {
  tabs: Tab[]
  activeTabId: string | null
}

function pinnedFirst(tabs: Tab[]): Tab[] {
  return [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)]
}

export function openTab(state: TabSnapshot, tab: Tab, maxTabs: number): TabSnapshot {
  if (state.tabs.some((item) => item.id === tab.id)) {
    return { ...state, activeTabId: tab.id }
  }

  const tabs = [...state.tabs]
  if (tabs.length >= maxTabs) {
    for (let index = tabs.length - 1; index >= 0; index -= 1) {
      if (!tabs[index].pinned) {
        tabs.splice(index, 1)
        break
      }
    }
  }
  tabs.push(tab)

  return { tabs: pinnedFirst(tabs), activeTabId: tab.id }
}

export function closeTab(state: TabSnapshot, id: string): TabSnapshot {
  const index = state.tabs.findIndex((tab) => tab.id === id)
  if (index === -1) return state

  const tabs = state.tabs.filter((tab) => tab.id !== id)
  if (state.activeTabId !== id) return { tabs, activeTabId: state.activeTabId }

  return { tabs, activeTabId: tabs[Math.min(index, tabs.length - 1)]?.id ?? null }
}

export function switchTab(state: TabSnapshot, id: string): TabSnapshot {
  return state.tabs.some((tab) => tab.id === id) ? { ...state, activeTabId: id } : state
}

export function deactivateTabs(state: TabSnapshot): TabSnapshot {
  return { ...state, activeTabId: null }
}

export function togglePinned(state: TabSnapshot, id: string): TabSnapshot {
  if (!state.tabs.some((tab) => tab.id === id)) return state

  const tabs = state.tabs.map((tab) => (
    tab.id === id ? { ...tab, pinned: !tab.pinned } : tab
  ))
  return { ...state, tabs: pinnedFirst(tabs) }
}

export function reorderTabs(
  state: TabSnapshot,
  fromIndex: number,
  toIndex: number,
): TabSnapshot {
  if (
    !Number.isInteger(fromIndex)
    || !Number.isInteger(toIndex)
    || fromIndex < 0
    || fromIndex >= state.tabs.length
    || toIndex < 0
    || toIndex >= state.tabs.length
  ) {
    return state
  }

  const tabs = [...state.tabs]
  const [moved] = tabs.splice(fromIndex, 1)
  tabs.splice(toIndex, 0, moved)
  return { ...state, tabs: pinnedFirst(tabs) }
}

export function closeOtherTabs(state: TabSnapshot, id: string): TabSnapshot {
  if (!state.tabs.some((tab) => tab.id === id)) return state

  const tabs = state.tabs.filter((tab) => tab.id === id || tab.pinned)
  return { tabs, activeTabId: id }
}

export function closeUnpinnedTabs(state: TabSnapshot): TabSnapshot {
  const tabs = state.tabs.filter((tab) => tab.pinned)
  return { tabs, activeTabId: tabs[0]?.id ?? null }
}
