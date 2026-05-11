# Navigation History & AI Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add back/forward navigation history across panels and sub-views, plus an AI search entry point (UI shell) to the TitleBar.

**Architecture:** New `navigationStore` (Zustand, plain `create`) manages a history stack of `NavigationEntry` discriminated union types. All navigation actions call `nav.push()` instead of directly mutating panel stores. TitleBar layout shifts to absolute-positioned left/right groups with centered `[NavHistoryButtons] [DynamicIsland] [AiSearchTrigger]`. AI search overlay is a Spotlight-style floating panel (UI shell only).

**Tech Stack:** React 19, TypeScript, Zustand v5, motion/react (Framer Motion), inline styles (matching existing codebase patterns).

**Spec:** `docs/superpowers/specs/2026-05-11-navigation-history-ai-search-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/renderer/src/stores/navigationStore.ts` | History stack, back/forward, AI search open state |
| `src/renderer/src/components/sidebar/NavHistoryButtons.tsx` | ◀▶ button pair, reads canBack/canForward |
| `src/renderer/src/components/sidebar/AiSearchTrigger.tsx` | ✨ gradient pill button, toggles overlay |
| `src/renderer/src/components/sidebar/AiSearchOverlay.tsx` | Floating search panel with backdrop (UI shell) |

### Modified Files

| File | What changes |
|------|-------------|
| `src/renderer/src/stores/planStore.ts` | Add `plannerView` + `setPlannerView` |
| `src/renderer/src/components/sidebar/TitleBar.tsx` | New centering layout with NavHistoryButtons + AiSearchTrigger |
| `src/renderer/src/components/sidebar/Sidebar.tsx` | Add AiSearchOverlay |
| `src/renderer/src/components/sidebar/DynamicIsland.tsx` | Replace `setActivePanel` with `nav.push()` |
| `src/renderer/src/components/sidebar/IconStrip.tsx` | Accept `nav.push` callback or call `nav.push` directly |
| `src/renderer/src/components/notes/NotesPanel.tsx` | Replace `setActiveNote(id)` with `nav.push()` |
| `src/renderer/src/components/notes/NoteEditor.tsx` | Replace `setActiveNote(null)` + `handleLinkClick` with `nav.push()` |
| `src/renderer/src/components/planner/PlannerPanel.tsx` | Read `plannerView` from store, wire `nav.push()` |
| `src/renderer/src/components/planner/PlanList.tsx` | Replace `setActivePlan(id)` + `handleStartFocusFromPlan` with `nav.push()` |
| `src/renderer/src/components/planner/PlanEditor.tsx` | Replace `setActivePlan(null)` + `handleLinkClick` with `nav.push()` |
| `src/renderer/src/components/planner/CalendarView.tsx` | Replace `setActivePlan(p.id)` with `nav.push()` |

---

## Task 1: Navigation Store

**Files:**
- Create: `src/renderer/src/stores/navigationStore.ts`

- [ ] **Step 1: Create navigationStore.ts**

```typescript
import { create } from 'zustand'
import { usePetStore } from './petStore'
import { useNoteStore } from './noteStore'
import { usePlanStore } from './planStore'

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
  return JSON.stringify(a) === JSON.stringify(b)
}

function restoreState(entry: NavigationEntry) {
  const petStore = usePetStore.getState()
  const noteStore = useNoteStore.getState()
  const planStore = usePlanStore.getState()

  petStore.setActivePanel(entry.panel)

  switch (entry.panel) {
    case 'planner':
      if (entry.subView === 'list') {
        planStore.setActivePlan(null)
        planStore.setPlannerView('list')
      } else if (entry.subView === 'calendar') {
        planStore.setActivePlan(null)
        planStore.setPlannerView('calendar')
      } else if (entry.subView === 'editor') {
        const exists = planStore.plans.some((p) => p.id === entry.planId)
        if (exists) {
          planStore.setActivePlan(entry.planId)
          planStore.setPlannerView('list')
        } else {
          planStore.setActivePlan(null)
          planStore.setPlannerView('list')
        }
      }
      break
    case 'notes':
      if (entry.subView === 'list') {
        noteStore.setActiveNote(null)
      } else if (entry.subView === 'editor') {
        const exists = noteStore.notes.some((n) => n.id === entry.noteId)
        if (exists) {
          noteStore.setActiveNote(entry.noteId)
        } else {
          noteStore.setActiveNote(null)
        }
      }
      break
    // timer, settings — no additional state
  }
}

export const useNavigationStore = create<NavigationStore>()((set, get) => ({
  entries: [{ panel: 'planner', subView: 'list' } as NavigationEntry],
  currentIndex: 0,
  canBack: false,
  canForward: false,
  isAiSearchOpen: false,

  push: (entry) => {
    const { entries, currentIndex } = get()
    if (entriesEqual(entries[currentIndex], entry)) return
    const newEntries = [...entries.slice(0, currentIndex + 1), entry]
    set({
      entries: newEntries,
      currentIndex: newEntries.length - 1,
      canBack: newEntries.length - 1 > 0,
      canForward: false,
    })
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
```

- [ ] **Step 2: Commit**

```
git add src/renderer/src/stores/navigationStore.ts
git commit -m "feat: add navigationStore with history stack and AI search state"
```

---

## Task 2: Lift plannerView to planStore

**Files:**
- Modify: `src/renderer/src/stores/planStore.ts:43-63` (interface)
- Modify: `src/renderer/src/stores/planStore.ts:65-71` (initial state)
- Modify: `src/renderer/src/stores/planStore.ts:182` (setters)
- Modify: `src/renderer/src/components/planner/PlannerPanel.tsx` (use store instead of local state)

- [ ] **Step 1: Add plannerView to PlanStore interface**

In `src/renderer/src/stores/planStore.ts`, add to the `PlanStore` interface (after `viewMode`):

```typescript
  plannerView: 'list' | 'calendar'
  setPlannerView: (view: 'list' | 'calendar') => void
```

- [ ] **Step 2: Add initial state and setter**

In the store body, add to initial state (after `viewMode: 'card'`):

```typescript
    plannerView: 'list',
```

Add the setter (after `setViewMode`):

```typescript
    setPlannerView: (view) => {
      set({ plannerView: view })
    },
```

- [ ] **Step 3: Update PlannerPanel to use store**

Replace the entire `src/renderer/src/components/planner/PlannerPanel.tsx`:

```tsx
import { useEffect } from 'react'
import { usePlanStore } from '@/stores/planStore'
import PlanList from './PlanList'
import CalendarView from './CalendarView'
import PlanEditor from './PlanEditor'

export default function PlannerPanel() {
  const load = usePlanStore((s) => s.load)
  const activePlanId = usePlanStore((s) => s.activePlanId)
  const plannerView = usePlanStore((s) => s.plannerView)
  const setPlannerView = usePlanStore((s) => s.setPlannerView)

  useEffect(() => { load() }, [load])

  if (activePlanId) return <PlanEditor planId={activePlanId} />

  if (plannerView === 'calendar') {
    return <CalendarView onSwitchView={(mode) => {
      usePlanStore.getState().setViewMode(mode)
      setPlannerView('list')
    }} />
  }

  return <PlanList onSwitchToCalendar={() => setPlannerView('calendar')} />
}
```

- [ ] **Step 4: Verify the app runs**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite dev`
Expected: App opens normally, planner panel works the same as before.

- [ ] **Step 5: Commit**

```
git add src/renderer/src/stores/planStore.ts src/renderer/src/components/planner/PlannerPanel.tsx
git commit -m "refactor: lift plannerView state from PlannerPanel to planStore"
```

---

## Task 3: NavHistoryButtons Component

**Files:**
- Create: `src/renderer/src/components/sidebar/NavHistoryButtons.tsx`

- [ ] **Step 1: Create NavHistoryButtons.tsx**

```tsx
import { useNavigationStore } from '@/stores/navigationStore'

export default function NavHistoryButtons() {
  const canBack = useNavigationStore((s) => s.canBack)
  const canForward = useNavigationStore((s) => s.canForward)
  const back = useNavigationStore((s) => s.back)
  const forward = useNavigationStore((s) => s.forward)
  const [backHovered, setBackHovered] = useState(false)
  const [fwdHovered, setFwdHovered] = useState(false)

  const btnStyle = (enabled: boolean, hovered: boolean): React.CSSProperties => ({
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    cursor: enabled ? 'pointer' : 'default',
    border: 'none',
    background: hovered && enabled ? 'rgba(255,255,255,0.1)' : 'transparent',
    opacity: enabled ? (hovered ? 0.8 : 0.5) : 0.15,
    transition: 'opacity 0.15s ease, background 0.15s ease',
    padding: 0,
  })

  const iconColor = (enabled: boolean) => enabled ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      <button
        onClick={back}
        disabled={!canBack}
        onMouseEnter={() => setBackHovered(true)}
        onMouseLeave={() => setBackHovered(false)}
        style={btnStyle(canBack, backHovered)}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M8 1L3 6L8 11" stroke={iconColor(canBack)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={forward}
        disabled={!canForward}
        onMouseEnter={() => setFwdHovered(true)}
        onMouseLeave={() => setFwdHovered(false)}
        style={btnStyle(canForward, fwdHovered)}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M4 1L9 6L4 11" stroke={iconColor(canForward)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
```

Note: Add `import { useState } from 'react'` at the top.

- [ ] **Step 2: Commit**

```
git add src/renderer/src/components/sidebar/NavHistoryButtons.tsx
git commit -m "feat: add NavHistoryButtons component"
```

---

## Task 4: AiSearchTrigger Component

**Files:**
- Create: `src/renderer/src/components/sidebar/AiSearchTrigger.tsx`

- [ ] **Step 1: Create AiSearchTrigger.tsx**

```tsx
import { useState } from 'react'
import { useNavigationStore } from '@/stores/navigationStore'

export default function AiSearchTrigger() {
  const toggleAiSearch = useNavigationStore((s) => s.toggleAiSearch)
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={toggleAiSearch}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered
          ? 'linear-gradient(135deg, rgba(0,122,255,0.25), rgba(175,82,222,0.25))'
          : 'linear-gradient(135deg, rgba(0,122,255,0.15), rgba(175,82,222,0.15))',
        transition: 'background 0.2s ease',
        padding: 0,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>✨</span>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```
git add src/renderer/src/components/sidebar/AiSearchTrigger.tsx
git commit -m "feat: add AiSearchTrigger component"
```

---

## Task 5: AiSearchOverlay Component

**Files:**
- Create: `src/renderer/src/components/sidebar/AiSearchOverlay.tsx`

- [ ] **Step 1: Create AiSearchOverlay.tsx**

```tsx
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigationStore } from '@/stores/navigationStore'

const SUGGESTIONS = [
  { icon: '🕐', text: '帮我总结今天的计划' },
  { icon: '🕐', text: '昨天写了什么笔记？' },
  { icon: '💡', text: '新建一个学习计划' },
  { icon: '💡', text: '开始 25 分钟专注' },
]

export default function AiSearchOverlay() {
  const isOpen = useNavigationStore((s) => s.isAiSearchOpen)
  const setAiSearchOpen = useNavigationStore((s) => s.setAiSearchOpen)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAiSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, setAiSearchOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            position: 'absolute',
            top: 36,
            left: 0,
            right: 72,
            bottom: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Backdrop — click to close */}
          <div
            style={{ position: 'absolute', inset: 0 }}
            onClick={() => setAiSearchOpen(false)}
          />

          {/* Content */}
          <div
            style={{
              position: 'relative',
              background: 'rgba(18,18,20,0.97)',
              borderBottom: '0.5px solid rgba(255,255,255,0.08)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Search input */}
            <div style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(0,122,255,0.3)',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 14, opacity: 0.6 }}>✨</span>
              <input
                ref={inputRef}
                placeholder="搜索或问 AI..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                }}
              />
              <span style={{
                color: 'rgba(255,255,255,0.2)',
                fontSize: 11,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 4,
                padding: '2px 6px',
                flexShrink: 0,
              }}>
                Esc 关闭
              </span>
            </div>

            {/* Suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SUGGESTIONS.map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    background: i === 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontSize: 11 }}>{s.icon}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              textAlign: 'center',
              fontSize: 11,
              color: 'rgba(255,255,255,0.2)',
              paddingTop: 4,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              AI 助手 · 未来接入
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```
git add src/renderer/src/components/sidebar/AiSearchOverlay.tsx
git commit -m "feat: add AiSearchOverlay component (UI shell)"
```

---

## Task 6: TitleBar Layout Rewrite

**Files:**
- Modify: `src/renderer/src/components/sidebar/TitleBar.tsx`

- [ ] **Step 1: Rewrite TitleBar with new centering layout**

Replace the entire `src/renderer/src/components/sidebar/TitleBar.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify the app runs and layout looks correct**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite dev`
Expected: TitleBar shows [⭐📌] on far left, [◀▶][DynamicIsland][✨] centered, [🔴🟡🟢] on far right.

- [ ] **Step 3: Commit**

```
git add src/renderer/src/components/sidebar/TitleBar.tsx
git commit -m "feat: rewrite TitleBar with centered nav group layout"
```

---

## Task 7: Wire AiSearchOverlay into Sidebar

**Files:**
- Modify: `src/renderer/src/components/sidebar/Sidebar.tsx`

- [ ] **Step 1: Add AiSearchOverlay to Sidebar**

In `src/renderer/src/components/sidebar/Sidebar.tsx`:

1. Add import: `import AiSearchOverlay from './AiSearchOverlay'`
2. Remove the `setActivePanel` line (will be wired through nav in Task 8).
3. Add `<AiSearchOverlay />` between `<TitleBar />` and the content area `<div>`. It needs to be inside the same positioned parent.

The updated JSX structure:

```tsx
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
```

Note: IconStrip no longer receives `onToggle` prop — it will call `nav.push()` directly (handled in Task 8).

- [ ] **Step 2: Commit**

```
git add src/renderer/src/components/sidebar/Sidebar.tsx
git commit -m "feat: add AiSearchOverlay to Sidebar"
```

---

## Task 8: Wire Navigation — DynamicIsland + IconStrip

**Files:**
- Modify: `src/renderer/src/components/sidebar/DynamicIsland.tsx:48-51` (handlePanelClick)
- Modify: `src/renderer/src/components/sidebar/DynamicIsland.tsx:52-56` (handleToggleTimer)
- Modify: `src/renderer/src/components/sidebar/IconStrip.tsx:32` (onClick)
- Modify: `src/renderer/src/components/sidebar/Sidebar.tsx` (remove onToggle prop)

- [ ] **Step 1: Update DynamicIsland to use nav.push**

In `src/renderer/src/components/sidebar/DynamicIsland.tsx`:

1. Add import: `import { useNavigationStore } from '@/stores/navigationStore'`
2. Replace `handlePanelClick`:

```typescript
const navPush = useNavigationStore((s) => s.push)

const handlePanelClick = (panelId: string) => {
  if (panelId === 'planner') {
    navPush({ panel: 'planner', subView: 'list' })
  } else if (panelId === 'notes') {
    navPush({ panel: 'notes', subView: 'list' })
  } else {
    navPush({ panel: panelId as any })
  }
}
```

3. Replace `handleToggleTimer`:

```typescript
const handleToggleTimer = () => {
  if (activePanel !== 'timer') {
    navPush({ panel: 'timer' })
  }
  if (timerStatus === 'running') {
    timerPause()
  } else if (timerStatus === 'paused') {
    timerResume()
  }
}
```

4. Remove the old `setActivePanel` import usage (keep the import from petStore if still used for reading `activePanel`).

- [ ] **Step 2: Update IconStrip to call nav.push directly**

In `src/renderer/src/components/sidebar/IconStrip.tsx`:

1. Remove `onToggle` from `IconStripProps` interface.
2. Add import: `import { useNavigationStore } from '@/stores/navigationStore'`
3. Add inside component: `const navPush = useNavigationStore((s) => s.push)`
4. Replace `onClick={() => onToggle(item.id as any)}` with:

```tsx
onClick={() => {
  const id = item.id
  if (id === 'planner') navPush({ panel: 'planner', subView: 'list' })
  else if (id === 'notes') navPush({ panel: 'notes', subView: 'list' })
  else navPush({ panel: id as any })
}}
```

- [ ] **Step 3: Update Sidebar — remove onToggle prop from IconStrip**

In `src/renderer/src/components/sidebar/Sidebar.tsx`:
- Remove `const setActivePanel = usePetStore((s) => s.setActivePanel)`
- Change `<IconStrip activePanel={activePanel} onToggle={setActivePanel} />` to `<IconStrip activePanel={activePanel} />`

- [ ] **Step 4: Verify**

Run the app. Click panel icons in DynamicIsland and IconStrip. Verify panels switch. Verify ◀ button becomes active after switching. Verify ◀ navigates back.

- [ ] **Step 5: Commit**

```
git add src/renderer/src/components/sidebar/DynamicIsland.tsx src/renderer/src/components/sidebar/IconStrip.tsx src/renderer/src/components/sidebar/Sidebar.tsx
git commit -m "feat: wire DynamicIsland and IconStrip through nav.push"
```

---

## Task 9: Wire Navigation — Notes Panel + NoteEditor

**Files:**
- Modify: `src/renderer/src/components/notes/NotesPanel.tsx:65-66` (setActiveNote call)
- Modify: `src/renderer/src/components/notes/NoteEditor.tsx:396-401` (back-to-list button)
- Modify: `src/renderer/src/components/notes/NoteEditor.tsx:244-251` (handleLinkClick)

- [ ] **Step 1: Update NotesPanel — click note card uses nav.push**

In `src/renderer/src/components/notes/NotesPanel.tsx`:

1. Add import: `import { useNavigationStore } from '@/stores/navigationStore'`
2. Add inside component: `const navPush = useNavigationStore((s) => s.push)`
3. Find where `setActiveNote` is called with an id (the `onClick={setActiveNote}` on `NoteCard` around line 232). Change it to:

```tsx
onClick={(id) => navPush({ panel: 'notes', subView: 'editor', noteId: id })}
```

- [ ] **Step 2: Update NoteEditor — back-to-list button uses nav.push**

In `src/renderer/src/components/notes/NoteEditor.tsx`:

1. Add import: `import { useNavigationStore } from '@/stores/navigationStore'`
2. Add inside component: `const navPush = useNavigationStore((s) => s.push)`
3. Find the ArrowLeft button `onClick` (around line 396-401):

Change from:
```tsx
onClick={() => {
  if (tocVisible) {
    setTocVisible(false)
  }
  setActiveNote(null)
}}
```

To:
```tsx
onClick={() => {
  if (tocVisible) {
    setTocVisible(false)
  }
  navPush({ panel: 'notes', subView: 'list' })
}}
```

- [ ] **Step 3: Update NoteEditor — handleLinkClick uses nav.push**

Find `handleLinkClick` (around line 244-251):

Change from:
```typescript
const handleLinkClick = useCallback((id: string, type: string) => {
  if (type === 'note') {
    setActiveNote(id)
  } else if (type === 'plan') {
    usePlanStore.getState().setActivePlan(id)
    usePetStore.getState().setActivePanel('planner')
  }
}, [setActiveNote])
```

To:
```typescript
const handleLinkClick = useCallback((id: string, type: string) => {
  if (type === 'note') {
    navPush({ panel: 'notes', subView: 'editor', noteId: id })
  } else if (type === 'plan') {
    navPush({ panel: 'planner', subView: 'editor', planId: id })
  }
}, [navPush])
```

- [ ] **Step 4: Commit**

```
git add src/renderer/src/components/notes/NotesPanel.tsx src/renderer/src/components/notes/NoteEditor.tsx
git commit -m "feat: wire NotesPanel and NoteEditor through nav.push"
```

---

## Task 10: Wire Navigation — Planner Panel + PlanList + PlanEditor + CalendarView

**Files:**
- Modify: `src/renderer/src/components/planner/PlanList.tsx:118-119` (handleCreateConfirm)
- Modify: `src/renderer/src/components/planner/PlanList.tsx:127-131` (handleStartFocusFromPlan)
- Modify: `src/renderer/src/components/planner/PlanList.tsx:218-219` (onSwitchToCalendar in toolbar)
- Modify: `src/renderer/src/components/planner/PlanEditor.tsx:269` (back-to-list button)
- Modify: `src/renderer/src/components/planner/PlanEditor.tsx:213-220` (handleLinkClick)
- Modify: `src/renderer/src/components/planner/CalendarView.tsx:221` (plan click)

- [ ] **Step 1: Update PlanList**

In `src/renderer/src/components/planner/PlanList.tsx`:

1. Add import: `import { useNavigationStore } from '@/stores/navigationStore'`
2. Add inside component: `const navPush = useNavigationStore((s) => s.push)`
3. In `handleCreateConfirm` (line ~118): Change `setActivePlan(plan.id)` to `navPush({ panel: 'planner', subView: 'editor', planId: plan.id })`
4. In `handleStartFocusFromPlan` (line ~127): Change `setActivePanel('timer')` to `navPush({ panel: 'timer' })`
5. In the toolbar `onViewModeChange` callback (line ~218-219): Where `onSwitchToCalendar()` is called, wrap it with a nav push. Change:
   ```tsx
   if (mode === 'calendar') onSwitchToCalendar()
   ```
   To:
   ```tsx
   if (mode === 'calendar') navPush({ panel: 'planner', subView: 'calendar' })
   ```
6. Find where `setActivePlan` is called directly (from `PlanCard` `onClick`). It should be changed similarly to pass through `navPush`. Look for `setActivePlan` calls in the card rendering and change them to `navPush({ panel: 'planner', subView: 'editor', planId: id })`.

- [ ] **Step 2: Update PlanEditor**

In `src/renderer/src/components/planner/PlanEditor.tsx`:

1. Add import: `import { useNavigationStore } from '@/stores/navigationStore'`
2. Add inside component: `const navPush = useNavigationStore((s) => s.push)`
3. ArrowLeft button (line ~269): Change `onClick={() => setActivePlan(null)}` to `onClick={() => navPush({ panel: 'planner', subView: 'list' })}`
4. `handleLinkClick` (line ~213-220): Change from:
   ```typescript
   const handleLinkClick = useCallback((id: string, type: string) => {
     if (type === 'plan') {
       setActivePlan(id)
     } else if (type === 'note') {
       useNoteStore.getState().setActiveNote(id)
       usePetStore.getState().setActivePanel('notes')
     }
   }, [setActivePlan])
   ```
   To:
   ```typescript
   const handleLinkClick = useCallback((id: string, type: string) => {
     if (type === 'plan') {
       navPush({ panel: 'planner', subView: 'editor', planId: id })
     } else if (type === 'note') {
       navPush({ panel: 'notes', subView: 'editor', noteId: id })
     }
   }, [navPush])
   ```

- [ ] **Step 3: Update CalendarView**

In `src/renderer/src/components/planner/CalendarView.tsx`:

1. Add import: `import { useNavigationStore } from '@/stores/navigationStore'`
2. Add inside component: `const navPush = useNavigationStore((s) => s.push)`
3. Remove the `setActivePlan` selector (line ~24)
4. Find the plan click handler (line ~221): Change `onClick={() => setActivePlan(p.id)}` to `onClick={() => navPush({ panel: 'planner', subView: 'editor', planId: p.id })}`

- [ ] **Step 4: Verify full flow**

Run the app. Test:
1. Click note card → opens editor. ◀ back → returns to list.
2. Click plan card → opens editor. ◀ back → returns to list.
3. Click wikilink in note to plan → switches to plan editor. ◀ back → returns to note editor.
4. Click calendar view → switches to calendar. ◀ back → returns to plan list.
5. Click plan in calendar → opens editor. ◀ back → returns to calendar.
6. Click ✨ → overlay slides down. Press Esc → overlay closes.

- [ ] **Step 5: Commit**

```
git add src/renderer/src/components/planner/PlanList.tsx src/renderer/src/components/planner/PlanEditor.tsx src/renderer/src/components/planner/CalendarView.tsx
git commit -m "feat: wire planner components through nav.push"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Full smoke test**

Run the app and verify:
- [ ] TitleBar layout: [⭐📌] left, [◀▶][DynamicIsland][✨] centered, [🔴🟡🟢] right
- [ ] Back/forward buttons disabled on initial state (gray, not clickable)
- [ ] Navigate to a different panel → ◀ becomes active
- [ ] Click ◀ → returns to previous panel
- [ ] Click ▶ → goes forward again
- [ ] Open a note → ◀ becomes active → ◀ back to list
- [ ] Open a plan → ◀ back to list
- [ ] Wikilink cross-panel navigation works and is tracked in history
- [ ] Calendar view navigation is tracked
- [ ] ✨ opens overlay with suggestions, Esc closes
- [ ] Window dragging still works on TitleBar (except on buttons)
- [ ] DynamicIsland hover/expand still works
- [ ] Timer active state in DynamicIsland still works
- [ ] Traffic lights (close/minimize/maximize) still work

- [ ] **Step 2: Final commit if any fixes needed**
