# Navigation History & AI Search Entry

Date: 2026-05-11

## Goal

Add two features to the TitleBar:
1. **Back/forward navigation** — browse history across panels and sub-views (like a browser)
2. **AI search entry point** — a visual trigger (✨) that opens a Spotlight-style floating search panel (UI shell only)

## Layout

TitleBar center group `[◀▶] [DynamicIsland] [✨]` is horizontally centered using `margin: 0 auto`. Left controls (⭐📌) and right controls (🔴🟡🟢) are absolutely positioned so they don't affect centering.

```
[⭐📌]         [◀▶] [DynamicIsland] [✨]         [🔴🟡🟢]
absolute left         margin: 0 auto           absolute right
```

The entire center group is wrapped in a single `<div style={{ WebkitAppRegion: 'no-drag' }}>` so there are no draggable dead zones between the three elements.

## 1. Navigation History System

### Data Model

```typescript
type NavigationEntry =
  | { panel: 'planner'; subView: 'list' }
  | { panel: 'planner'; subView: 'editor'; planId: string }
  | { panel: 'planner'; subView: 'calendar' }
  | { panel: 'notes'; subView: 'list' }
  | { panel: 'notes'; subView: 'editor'; noteId: string }
  | { panel: 'timer' }
  | { panel: 'settings' }
```

### Store: `useNavigationStore`

New Zustand store (plain `create`, no immer — matches `petStore` pattern). Independent of `petStore`.

```
entries: NavigationEntry[]    — history stack
currentIndex: number          — current position
canBack: boolean              — computed: currentIndex > 0
canForward: boolean           — computed: currentIndex < entries.length - 1
```

**Actions:**

- `push(entry)` — Push a new entry. Truncates forward history (entries after currentIndex), then appends. Skips if entry equals `entries[currentIndex]` (dedup).
- `back()` — Decrement index, restore state from `entries[currentIndex]`.
- `forward()` — Increment index, restore state from `entries[currentIndex]`.

**State restoration** in `back()`/`forward()`:

1. Read target entry from `entries[newIndex]`.
2. Call `petStore.setActivePanel(entry.panel)`.
3. Panel-specific restoration:
   - `'planner'` + `subView: 'list'` → `planStore.setActivePlan(null)`, `planStore.setPlannerView('list')`
   - `'planner'` + `subView: 'editor'` → validate planId exists in `planStore.plans`; if not, fall back to `{ panel: 'planner', subView: 'list' }`. Otherwise `planStore.setActivePlan(entry.planId)`, `planStore.setPlannerView('list')`.
   - `'planner'` + `subView: 'calendar'` → `planStore.setActivePlan(null)`, `planStore.setPlannerView('calendar')`
   - `'notes'` + `subView: 'list'` → `noteStore.setActiveNote(null)`
   - `'notes'` + `subView: 'editor'` → validate noteId exists in `noteStore.notes`; if not, fall back to `{ panel: 'notes', subView: 'list' }`. Otherwise `noteStore.setActiveNote(entry.noteId)`.
   - `'timer'` / `'settings'` → no additional state needed.

**Deleted item handling:** On restoration, if the referenced entity (note/plan) no longer exists, fall back to the list view for that panel. Do NOT prune history entries — stale entries are harmless and preserve the user's navigation timeline.

### Planner view state lift

`PlannerPanel` currently manages the list/calendar switch via local `useState`. To support back/forward to the calendar view, lift this state to `planStore`:

```
planStore.plannerView: 'list' | 'calendar'    (default: 'list')
planStore.setPlannerView: (view) => void
```

`PlannerPanel` reads `plannerView` from the store instead of local state.

### Who calls `push`?

All navigation actions that change the visible view must call `nav.push()`:

| Trigger | Entry pushed |
|---------|-------------|
| DynamicIsland panel click | `{ panel: 'xxx' }` (or `{ panel: 'xxx', subView: 'list' }` for planner/notes) |
| DynamicIsland timer toggle (when not on timer) | `{ panel: 'timer' }` |
| IconStrip panel click | `{ panel: 'xxx' }` |
| NoteEditor: back to list button | `{ panel: 'notes', subView: 'list' }` |
| NotesPanel: click note card | `{ panel: 'notes', subView: 'editor', noteId }` |
| PlanEditor: back to list button | `{ panel: 'planner', subView: 'list' }` |
| PlanList: click plan card | `{ panel: 'planner', subView: 'editor', planId }` |
| PlanList: "start focus" action | `{ panel: 'timer' }` |
| PlannerPanel: switch to calendar | `{ panel: 'planner', subView: 'calendar' }` |
| PlannerPanel: switch back to list from calendar | `{ panel: 'planner', subView: 'list' }` |
| CalendarView: click plan | `{ panel: 'planner', subView: 'editor', planId }` |
| NoteEditor: wikilink to plan | `{ panel: 'planner', subView: 'editor', planId }` |
| PlanEditor: wikilink to note | `{ panel: 'notes', subView: 'editor', noteId }` |

**Initial entry:** On app mount, push `{ panel: 'planner', subView: 'list' }` as the starting point.

### Local state loss on navigation

When panels unmount during navigation, local component state (search query, filter tags, scroll position, edit mode) is lost. This is acceptable and matches browser behavior (going back to a page does not restore form inputs or scroll position in most SPA frameworks). Only the entity-level navigation state (which panel, which note/plan, which sub-view) is preserved.

### Component: `NavHistoryButtons`

Small component rendering ◀ and ▶ buttons.

- Reads `canBack`/`canForward` from `useNavigationStore`.
- Disabled state: `opacity: 0.15`, `pointerEvents: 'none'`.
- Active state: `opacity: 0.5`, on hover `opacity: 0.8`, accent color tint.
- Buttons are 20×20 with SVG chevron icons (matching existing TitleBar icon style).

## 2. TitleBar Layout Changes

### Changes to `TitleBar.tsx`

- Container gets `position: 'relative'`.
- Left group (⭐📌): `position: 'absolute'; left: 14px`.
- Right group (TrafficLights): `position: 'absolute'; right: 14px`.
- Center group: `margin: '0 auto'`, wrapped in a single `WebkitAppRegion: 'no-drag'` div containing `NavHistoryButtons` + `DynamicIsland` + `AiSearchTrigger` with `gap: 8`.
- Remove the two `flex: 1` spacers.

## 3. AI Search Overlay

### Component: `AiSearchTrigger`

A small button (✨ icon) in the TitleBar center group, right of the DynamicIsland.

- Style: gradient background `linear-gradient(135deg, rgba(0,122,255,0.15), rgba(175,82,222,0.15))`, rounded pill.
- On click: toggles `isAiSearchOpen` state.

### State

`useNavigationStore` gains:

```
isAiSearchOpen: boolean
setAiSearchOpen: (v: boolean) => void
toggleAiSearch: () => void
```

### Component: `AiSearchOverlay`

Floating panel that appears below the TitleBar, overlaying the panel content area.

**Placement:** Rendered in `Sidebar.tsx`, positioned absolutely below the TitleBar, above PanelRouter.

**Z-index & pointer events:**
- `z-index: 100` (above PanelRouter and IconStrip).
- When open, overlay captures all pointer events. Content below is not interactive (the overlay has an opaque background so this is natural).
- When closed (`AnimatePresence` exit), pointer events pass through.

**Content (UI shell only):**
- Search input with ✨ icon, "搜索或问 AI..." placeholder.
- 4 hardcoded suggestion items (placeholder text, no real functionality).
- "Esc 关闭" hint.
- Footer: "AI 助手 · 未来接入".

**Behavior:**
- `AnimatePresence` + `motion.div` for slide-down / fade-out animation.
- `Esc` key closes the overlay (global keydown listener when open).
- Click-outside: since the TitleBar has `WebkitAppRegion: 'drag'` which swallows click events, use a transparent full-size backdrop div behind the overlay content. Clicking the backdrop closes the overlay.

**Visual:**
- Semi-transparent dark background `rgba(18,18,20,0.97)`.
- Rounded bottom corners matching the sidebar.
- Subtle top border `rgba(255,255,255,0.08)`.

## Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/src/stores/navigationStore.ts` | Navigation history store + AI search state |
| `src/renderer/src/components/sidebar/NavHistoryButtons.tsx` | ◀▶ button pair |
| `src/renderer/src/components/sidebar/AiSearchTrigger.tsx` | ✨ trigger button |
| `src/renderer/src/components/sidebar/AiSearchOverlay.tsx` | Floating search panel (UI shell) |

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/src/stores/planStore.ts` | Add `plannerView` / `setPlannerView` state |
| `src/renderer/src/components/sidebar/TitleBar.tsx` | New centering layout, add NavHistoryButtons + AiSearchTrigger |
| `src/renderer/src/components/sidebar/Sidebar.tsx` | Add AiSearchOverlay between TitleBar and PanelRouter |
| `src/renderer/src/components/sidebar/DynamicIsland.tsx` | Replace `setActivePanel` calls with `nav.push()` |
| `src/renderer/src/components/sidebar/IconStrip.tsx` | Replace `setActivePanel` calls with `nav.push()` |
| `src/renderer/src/components/notes/NotesPanel.tsx` | Replace `setActiveNote` calls with `nav.push()` |
| `src/renderer/src/components/notes/NoteEditor.tsx` | Replace back-to-list + wikilink navigation with `nav.push()` |
| `src/renderer/src/components/planner/PlanList.tsx` | Replace plan editor navigation with `nav.push()` |
| `src/renderer/src/components/planner/PlannerPanel.tsx` | Lift view state to store, wire sub-view navigation through `nav.push()` |
| `src/renderer/src/components/planner/PlanEditor.tsx` | Replace back-to-list + wikilink navigation with `nav.push()` |
| `src/renderer/src/components/planner/CalendarView.tsx` | Replace plan click navigation with `nav.push()` |
