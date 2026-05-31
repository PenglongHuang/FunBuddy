# Tab Bar Design — Planner & Notes

## Overview

Add a browser-like tab bar to the planner and notes panels, allowing users to have multiple documents open simultaneously, switch between them, pin frequently used documents, reorder tabs by dragging, and persist all state across app restarts.

## Decisions

| Aspect | Decision |
|--------|----------|
| Scope | Independent tab bars for planner and notes |
| Placement | Top of editor area, only visible when tabs exist |
| List relationship | List view is the "empty state" — closing all tabs returns to list |
| Persistence | All tab state (order, pinned, active) persisted via electron-store |
| Overflow | Horizontal scrolling |
| Architecture | Extend existing stores (planStore / noteStore) |
| Max tabs | Configurable in settings, default 20 |
| Nav history limit | Configurable in settings, default 100 |

## Data Model

### Tab interface (shared)

```typescript
interface Tab {
  id: string       // matches plan.id or note.id
  title: string    // display title, refreshed from index on load
  pinned: boolean  // pinned tabs stay left, no close button
}
```

### Store changes

**planStore** additions:
- `tabs: Tab[]` — ordered list of open tabs (pinned first)
- `activeTabId: string | null` — replaces `activePlanId`

**noteStore** additions:
- `tabs: Tab[]` — ordered list of open tabs (pinned first)
- `activeTabId: string | null` — replaces `activeNoteId`

### Store actions

```
openTab(id)              — open tab (activate if exists, append+activate if new)
closeTab(id)             — close tab, activate adjacent or clear
switchTab(id)            — activate tab without pushing nav entry
pinTab(id)               — toggle pin (pinned moves to left group)
reorderTabs(fromIdx, toIdx) — drag reorder within pinned/unpinned groups
closeOtherTabs(id)       — close all except given + pinned
closeUnpinnedTabs()      — close all unpinned tabs
```

### Persistence

Tab state stored in electron-store alongside existing prefs:
- `planPrefs` → `{ tabs, activeTabId, sortBy, viewMode }`
- `notePrefs` → `{ tabs, activeTabId, sortBy, viewMode, editorMode, tocMaxLevel }`

On app launch, `loadPlans()` / `loadNotes()` restores tabs and filters out any whose file no longer exists. If the active tab was removed, activate the adjacent tab or fall back to list view.

### Settings additions

Added to `settingsStore` under `settings.app`:

```typescript
maxTabsPerPanel: number    // default: 20
navHistoryLimit: number    // default: 100
```

When `openTab` is called and tab count exceeds `maxTabsPerPanel`, the least-recently-visited unpinned tab is automatically closed.

`navHistoryLimit` caps the navigation history stack in `navigationStore`. Entries beyond the limit are discarded from the bottom of the stack.

## Component Structure

```
PlannerPanel
├─ TabBar              ← rendered when tabs.length > 0
│  ├─ TabItem × N      ← draggable, with motion animations
│  └─ ContextMenu       ← right-click menu
├─ PlanEditor          ← activeTabId is set
└─ PlanList            ← tabs is empty (empty state)

NotesPanel
├─ TabBar              ← same component, different props
│  ├─ TabItem × N
│  └─ ContextMenu
├─ NoteEditor
└─ NoteList
```

### TabBar component

Reusable component receiving props:
- `tabs: Tab[]`
- `activeTabId: string | null`
- `onSelect(id): void`
- `onClose(id): void`
- `onPin(id): void`
- `onReorder(fromIdx, toIdx): void`
- `onCloseOthers(id): void`
- `onCloseUnpinned(): void`

No internal state — fully controlled by parent store.

### TabItem component

Individual tab with:
- Title text (truncated with ellipsis if too long)
- Close button (✕) — hidden for pinned tabs, shown on hover for unpinned
- Pin icon (📌) — shown for pinned tabs
- Blue bottom border for active tab
- Semi-transparent drag ghost at original position during drag
- Motion layout animation for smooth reorder

## Interaction Design

### Normal state

- Pinned tabs on the left side, no close button
- Active tab: elevated background + blue bottom border
- Inactive tabs: subdued text color, close button on hover
- Horizontal scroll when tabs exceed width

### Click behavior

- Click tab → `switchTab(id)`, no new nav entry (avoids stack bloat)
- Click close (✕) → close tab, activate adjacent
- Click tab title → same as click tab

### Right-click context menu

**Unpinned tab:**
- 📌 固定 Tab
- ✕ 关闭
- 关闭其他
- 关闭所有未固定

**Pinned tab:**
- 📍 取消固定
- 关闭其他
- 关闭所有未固定

### Drag reorder

- Dragging shows a blue vertical line indicator at the drop target
- Original position shows semi-transparent ghost
- Pinned tabs can reorder among themselves
- Unpinned tabs can reorder among themselves
- Pinned and unpinned groups cannot cross (drop indicator won't appear between groups)
- Dragging outside the tab bar cancels the operation

### Navigation integration

1. **List card click** → `openTab(id)` + `navPush(editor)` → tab bar appears, new tab active
2. **Tab bar click** → `switchTab(id)` → only changes `activeTabId`, no nav push
3. **Close last tab** → clear tabs, `activeTabId = null` → list view shown
4. **Back button** → existing behavior: return to list view (equivalent to closing current tab context)

### Dirty state handling

Closing a tab with unsaved editor content triggers a `ConfirmDialog`:
- "此文件有未保存的更改，确定要关闭吗？"
- 确认 → close tab (discard changes)
- 取消 → keep tab open

## Edge Cases

- **File deleted externally**: On launch, tabs referencing deleted files are removed from the restored list
- **File renamed externally**: Title is refreshed from `plans/index.json` / `notes/index.json` on load; tab stores only `id`, not title
- **Panel switching**: Each panel's tab state is independent; switching between planner/notes preserves both states
- **Active tab deleted**: Activate adjacent tab (prefer right neighbor), or fall back to list if no tabs remain

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/src/types/plan.ts` | Add `Tab` interface |
| `src/renderer/src/stores/planStore.ts` | Add tabs state, actions, persistence |
| `src/renderer/src/stores/noteStore.ts` | Add tabs state, actions, persistence |
| `src/renderer/src/stores/navigationStore.ts` | Respect `navHistoryLimit` setting |
| `src/renderer/src/stores/settingsStore.ts` | Add `maxTabsPerPanel`, `navHistoryLimit` settings |
| `src/renderer/src/components/common/TabBar.tsx` | New reusable TabBar component |
| `src/renderer/src/components/common/TabItem.tsx` | New TabItem component |
| `src/renderer/src/components/planner/PlannerPanel.tsx` | Integrate TabBar, conditional rendering |
| `src/renderer/src/components/notes/NotesPanel.tsx` | Integrate TabBar, conditional rendering |
| `src/renderer/src/components/settings/SettingsPanel.tsx` | Add settings UI for max tabs and nav history |
| `src/shared/store-schema.ts` | Add new settings to schema |
