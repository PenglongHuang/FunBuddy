import { create } from 'zustand'
import type { PetState } from '@/types/pet'

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
  tocVisible: boolean
  setTocVisible: (v: boolean) => void
}

export const usePetStore = create<PetStore>((set) => ({
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
  tocVisible: false,
  setTocVisible: (v) => set({ tocVisible: v }),
}))
