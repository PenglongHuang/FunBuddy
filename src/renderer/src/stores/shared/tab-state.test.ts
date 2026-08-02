import { describe, expect, it } from 'vitest'
import {
  closeOtherTabs,
  closeTab,
  closeUnpinnedTabs,
  deactivateTabs,
  openTab,
  reorderTabs,
  switchTab,
  togglePinned,
} from './tab-state'

const tabs = [
  { id: 'a', title: 'A', pinned: true },
  { id: 'b', title: 'B', pinned: false },
  { id: 'c', title: 'C', pinned: false },
]

describe('shared tab state', () => {
  it('activates an existing tab without duplicating it', () => {
    expect(openTab({ tabs, activeTabId: 'a' }, tabs[1], 20)).toEqual({ tabs, activeTabId: 'b' })
  })

  it('evicts the last unpinned tab at the limit', () => {
    expect(openTab({ tabs, activeTabId: 'a' }, { id: 'd', title: 'D', pinned: false }, 3)).toEqual({
      tabs: [tabs[0], tabs[1], { id: 'd', title: 'D', pinned: false }],
      activeTabId: 'd',
    })
  })

  it('preserves pinned tabs when every tab is pinned at the limit', () => {
    const pinnedTabs = tabs.map((tab) => ({ ...tab, pinned: true }))
    expect(openTab(
      { tabs: pinnedTabs, activeTabId: 'a' },
      { id: 'd', title: 'D', pinned: false },
      3,
    )).toEqual({
      tabs: [...pinnedTabs, { id: 'd', title: 'D', pinned: false }],
      activeTabId: 'd',
    })
  })

  it('selects the neighbor when closing the active tab', () => {
    expect(closeTab({ tabs, activeTabId: 'b' }, 'b')).toEqual({
      tabs: [tabs[0], tabs[2]],
      activeTabId: 'c',
    })
  })

  it('switches and deactivates tabs', () => {
    expect(switchTab({ tabs, activeTabId: 'a' }, 'c')).toEqual({ tabs, activeTabId: 'c' })
    expect(deactivateTabs({ tabs, activeTabId: 'a' })).toEqual({ tabs, activeTabId: null })
  })

  it('keeps pinned tabs before unpinned tabs', () => {
    expect(togglePinned({ tabs, activeTabId: 'b' }, 'c').tabs.map((tab) => tab.id)).toEqual(['a', 'c', 'b'])
    expect(reorderTabs({ tabs, activeTabId: 'b' }, 2, 0).tabs.map((tab) => tab.id)).toEqual(['a', 'c', 'b'])
  })

  it('closes other and unpinned tabs using the current active fallback', () => {
    expect(closeOtherTabs({ tabs, activeTabId: 'c' }, 'b')).toEqual({
      tabs: [tabs[0], tabs[1]],
      activeTabId: 'b',
    })
    expect(closeUnpinnedTabs({ tabs, activeTabId: 'c' })).toEqual({
      tabs: [tabs[0]],
      activeTabId: 'a',
    })
  })

  it('does not mutate or corrupt state for unknown ids and invalid indices', () => {
    const state = { tabs, activeTabId: 'b' }

    expect(closeTab(state, 'missing')).toBe(state)
    expect(switchTab(state, 'missing')).toBe(state)
    expect(togglePinned(state, 'missing')).toBe(state)
    expect(closeOtherTabs(state, 'missing')).toBe(state)
    expect(reorderTabs(state, -1, 0)).toBe(state)
    expect(reorderTabs(state, 1, 3)).toBe(state)
    expect(state).toEqual({ tabs, activeTabId: 'b' })
  })
})
