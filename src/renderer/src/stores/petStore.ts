import { create } from 'zustand'
import type { PetState } from '@/types/pet'
import { windowApi } from '@/lib/ipc'

interface PetStore {
  state: PetState
  setState: (newState: PetState) => void
  lastInteraction: number
  touch: () => void
  windowMode: 'pet' | 'expanded'
  setWindowMode: (mode: 'pet' | 'expanded') => void
  activePanel: 'planner' | 'timer' | 'notes' | 'settings'
  setActivePanel: (panel: 'planner' | 'timer' | 'notes' | 'settings') => void
  petPosition: { x: number; y: number } | null
  setPetPosition: (pos: { x: number; y: number } | null) => void
  petHovered: boolean
  setPetHovered: (v: boolean) => void
  isPinned: boolean
  togglePinned: () => void
  timerBubblePinned: boolean
  setTimerBubblePinned: (v: boolean) => void
}

export const usePetStore = create<PetStore>((set, get) => ({
  state: 'smile',
  setState: (state) => set({ state, lastInteraction: Date.now() }),
  lastInteraction: Date.now(),
  touch: () => set({ lastInteraction: Date.now() }),
  windowMode: 'pet',
  setWindowMode: (mode) => set({ windowMode: mode }),
  activePanel: 'planner',
  setActivePanel: (panel) => set({ activePanel: panel }),
  petPosition: null,
  setPetPosition: (pos) => set({ petPosition: pos }),
  petHovered: false,
  setPetHovered: (v) => set({ petHovered: v }),
  isPinned: false,
  timerBubblePinned: false,
  setTimerBubblePinned: (v) => set({ timerBubblePinned: v }),
  togglePinned: () => {
    const next = !get().isPinned
    set({ isPinned: next })
    windowApi.toggleAlwaysOnTop().catch(() => {
      set({ isPinned: !next })
    })
  },
}))
