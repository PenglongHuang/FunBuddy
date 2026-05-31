import { create } from 'zustand'
import { usePetStore } from './petStore'
import { useNoteStore } from './noteStore'
import { usePlanStore } from './planStore'
import { useSettingsStore } from './settingsStore'

type NavigationEntry =
  | { panel: 'planner'; subView: 'list' }
  | { panel: 'planner'; subView: 'editor'; planId: string }
  | { panel: 'planner'; subView: 'calendar' }
  | { panel: 'notes'; subView: 'list' }
  | { panel: 'notes'; subView: 'editor'; noteId: string }
  | { panel: 'timer' }
  | { panel: 'settings' }

interface NavigationStore {
  entries: NavigationEntry[]
  currentIndex: number
  canBack: boolean
  canForward: boolean
  isAiSearchOpen: boolean
  push: (entry: NavigationEntry) => void
  back: () => void
  forward: () => void
  setAiSearchOpen: (v: boolean) => void
  toggleAiSearch: () => void
}

function entriesEqual(a: NavigationEntry, b: NavigationEntry): boolean {
  if (a.panel !== b.panel) return false
  if ('subView' in a && 'subView' in b && a.subView !== b.subView) return false
  if ('noteId' in a && 'noteId' in b && a.noteId !== b.noteId) return false
  if ('planId' in a && 'planId' in b && a.planId !== b.planId) return false
  return true
}

function restoreState(entry: NavigationEntry) {
  const petStore = usePetStore.getState()
  const noteStore = useNoteStore.getState()
  const planStore = usePlanStore.getState()

  petStore.setActivePanel(entry.panel)

  switch (entry.panel) {
    case 'planner':
      if (entry.subView === 'list') {
        planStore.deactivateTab()
        planStore.setPlannerView('list')
      } else if (entry.subView === 'calendar') {
        planStore.deactivateTab()
        planStore.setPlannerView('calendar')
      } else if (entry.subView === 'editor') {
        const exists = planStore.plans.some((p) => p.id === entry.planId)
        if (exists) {
          planStore.openTab(entry.planId)
          planStore.setPlannerView('list')
        } else {
          planStore.setActivePlan(null)
          planStore.setPlannerView('list')
        }
      }
      break
    case 'notes':
      if (entry.subView === 'list') {
        noteStore.deactivateTab()
      } else if (entry.subView === 'editor') {
        const exists = noteStore.notes.some((n) => n.id === entry.noteId)
        if (exists) {
          noteStore.openTab(entry.noteId)
        } else {
          noteStore.setActiveNote(null)
        }
      }
      break
    // timer, settings — no additional state
  }
}

export const useNavigationStore = create<NavigationStore>()((set, get) => ({
  entries: [{ panel: 'planner', subView: 'list' }],
  currentIndex: 0,
  canBack: false,
  canForward: false,
  isAiSearchOpen: false,

  push: (entry) => {
    const { entries, currentIndex } = get()
    if (entriesEqual(entries[currentIndex], entry)) return
    const MAX_HISTORY = useSettingsStore.getState().app.navHistoryLimit || 100
    let newEntries = [...entries.slice(0, currentIndex + 1), entry]
    if (newEntries.length > MAX_HISTORY) {
      const offset = newEntries.length - MAX_HISTORY
      set({
        entries: newEntries.slice(offset),
        currentIndex: newEntries.length - 1 - offset,
        canBack: true,
        canForward: false,
      })
    } else {
      set({
        entries: newEntries,
        currentIndex: newEntries.length - 1,
        canBack: newEntries.length - 1 > 0,
        canForward: false,
      })
    }
    restoreState(entry)
  },

  back: () => {
    const { currentIndex, entries } = get()
    if (currentIndex <= 0) return
    const newIndex = currentIndex - 1
    set({ currentIndex: newIndex, canBack: newIndex > 0, canForward: true })
    restoreState(entries[newIndex])
  },

  forward: () => {
    const { currentIndex, entries } = get()
    if (currentIndex >= entries.length - 1) return
    const newIndex = currentIndex + 1
    set({ currentIndex: newIndex, canBack: true, canForward: newIndex < entries.length - 1 })
    restoreState(entries[newIndex])
  },

  setAiSearchOpen: (v) => set({ isAiSearchOpen: v }),
  toggleAiSearch: () => set((s) => ({ isAiSearchOpen: !s.isAiSearchOpen })),
}))

export type { NavigationEntry }
