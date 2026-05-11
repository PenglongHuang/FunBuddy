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

## 1. Navigation History System

### Data Model

```typescript
type NavigationEntry =
  | { panel: 'planner'; subView: 'list' }
  | { panel: 'planner'; subView: 'editor'; planId: string }
  | { panel: 'notes'; subView: 'list' }
  | { panel: 'notes'; subView: 'editor'; noteId: string }
  | { panel: 'timer' }
  | { panel: 'settings' }
```

### Store: `useNavigationStore`

New Zustand store, independent of `petStore`.

```
entries: NavigationEntry[]    — history stack
currentIndex: number          — current position
canBack: boolean              — computed: currentIndex > 0
canForward: boolean           — computed: currentIndex < entries.length - 1
```

**Actions:**

- `push(entry)` — Push a new entry. Truncates forward history (entries after currentIndex), then appends.
- `back()` — Decrement index, restore state from `entries[currentIndex]`.
- `forward()` — Increment index, restore state from `entries[currentIndex]`.

**State restoration** in `back()`/`forward()`:
1. Read target entry from `entries[newIndex]`.
2. Call `petStore.setActivePanel(entry.panel)`.
3. If entry has `subView` + id, call the panel-specific store (e.g. `noteStore.setActiveNote(entry.noteId)`).
4. If entry's `subView` is `'list'`, clear the panel-specific active id (e.g. `noteStore.setActiveNote(null)`).

**Who calls `push`?**

Navigation actions that should create history entries must call `nav.push()` instead of directly mutating stores:

| Trigger | Entry pushed |
|---------|-------------|
| DynamicIsland panel click | `{ panel: 'xxx' }` |
| NotesPanel: open note | `{ panel: 'notes', subView: 'editor', noteId }` |
| NotesPanel: back to list | `{ panel: 'notes', subView: 'list' }` |
| PlanList: open plan editor | `{ panel: 'planner', subView: 'editor', planId }` |
| PlanList: back to list | `{ panel: 'planner', subView: 'list' }` |
| PlannerPanel: switch to calendar | `{ panel: 'planner', subView: 'calendar' }` |

**Deduplication:** `push` should skip if the new entry equals `entries[currentIndex]` (prevents double-push on same view).

**Initial entry:** On app mount, push `{ panel: 'planner', subView: 'list' }` as the starting point.

### Component: `NavHistoryButtons`

Small component rendering ◀ and ▶ buttons.

- Reads `canBack`/`canForward` from `useNavigationStore`.
- Disabled state: `opacity: 0.15`, `pointerEvents: 'none'`.
- Active state: `opacity: 0.5`, on hover `opacity: 0.8`, accent color tint.
- Buttons are 20×20 with SVG chevron icons (matching existing TitleBar icon style).
- `WebkitAppRegion: 'no-drag'` to allow clicks.

## 2. TitleBar Layout Changes

### Changes to `TitleBar.tsx`

- Container gets `position: 'relative'`.
- Left group (⭐📌): `position: 'absolute'; left: 14px`.
- Right group (TrafficLights): `position: 'absolute'; right: 14px`.
- Center group: `margin: '0 auto'`, contains `NavHistoryButtons` + `DynamicIsland` + `AiSearchTrigger` with `gap: 8`.
- Remove the two `flex: 1` spacers.

### New imports in TitleBar

```tsx
import NavHistoryButtons from './NavHistoryButtons'
import AiSearchTrigger from './AiSearchTrigger'
```

## 3. AI Search Overlay

### Component: `AiSearchTrigger`

A small button (✨ icon) in the TitleBar center group, right of the DynamicIsland.

- Style: gradient background `linear-gradient(135deg, rgba(0,122,255,0.15), rgba(175,82,222,0.15))`, rounded pill.
- On click: toggles `isAiSearchOpen` state in `useNavigationStore`.
- `WebkitAppRegion: 'no-drag'`.

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

**Content (UI shell only):**
- Search input with ✨ icon, "搜索或问 AI..." placeholder.
- 4 hardcoded suggestion items (placeholder text, no real functionality).
- "Esc 关闭" hint.
- Footer: "AI 助手 · 未来接入".

**Behavior:**
- `AnimatePresence` + `motion.div` for slide-down / fade-out animation.
- `Esc` key closes the overlay.
- Click outside overlay closes it (backdrop click or checking `event.target`).

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
| `src/renderer/src/components/sidebar/TitleBar.tsx` | New centering layout, add NavHistoryButtons + AiSearchTrigger |
| `src/renderer/src/components/sidebar/Sidebar.tsx` | Add AiSearchOverlay between TitleBar and PanelRouter |
| `src/renderer/src/components/sidebar/DynamicIsland.tsx` | Replace `setActivePanel` calls with `nav.push()` |
| `src/renderer/src/components/notes/NotesPanel.tsx` | Replace `setActiveNote` calls with `nav.push()` |
| `src/renderer/src/components/planner/PlanList.tsx` | Replace plan editor navigation with `nav.push()` |
| `src/renderer/src/components/planner/PlannerPanel.tsx` | Wire sub-view navigation through `nav.push()` |
