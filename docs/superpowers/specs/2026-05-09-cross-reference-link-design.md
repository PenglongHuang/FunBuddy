# Cross-Reference Link Design

Insert clickable references to plans and notes within the Markdown editor, enabling navigation between documents.

## Syntax

**Storage format:**

```
[[id|显示标题]]
```

- `id` — nanoid (8 characters) of the target plan or note
- `显示标题` — human-readable title for source readability

**Examples:**

```markdown
今天完成了 [[abc12345|周计划-5月]] 的部分任务，
相关笔记见 [[def67890|React学习笔记]]
```

**Design decisions:**

- No type prefix — id is globally unique (nanoid collision is negligible), type is resolved at render time by checking both `plans/index.json` and `notes/index.json`
- Title sync — when the target's title changes, the display title in existing links is updated on next save/load; id never changes, links never break
- Deleted targets — rendered as red strikethrough with "[已删除: 旧标题]" label

## Trigger Mechanisms

Three ways to trigger the link insertion flow:

1. **Type `@`** — when cursor is preceded by whitespace or line start, a search popup appears below cursor
2. **Type `[[`** — same behavior as `@`
3. **Context menu / `Ctrl+Shift+L`** — opens search popup at cursor position

**Trigger guard:** `@` and `[[` only trigger when preceded by whitespace or line start. Typing `foo@bar` or inline `[text](url)` does not trigger.

## Search Popup

**Component:** `LinkSuggestionPopup`

**Layout:**

- Appears directly below the cursor in the editor
- Search input at top (auto-focused)
- Results list below, grouped by type (plans first, notes second)

**Each result shows:**

- Type icon (📄 plan / 📝 note)
- Title
- Tag summary (first 2-3 tags)

**Keyboard navigation:**

- Arrow Up/Down — move selection
- Enter — confirm selection
- Esc — close popup

**Behavior:**

- Real-time fuzzy search across all plan and note titles
- Max 10 results displayed
- On select: remove trigger characters (`@` or `[[`), insert `[[id|标题]]` at cursor position
- On close without selection: restore original text (remove trigger characters if they were `@`/`[[`)

## Preview Rendering

**In MarkdownPreview:**

Before rendering markdown to HTML, apply link-parser to replace `[[id|标题]]` patterns with styled HTML spans:

- Plan link: blue pill badge with 📄 icon
- Note link: purple pill badge with 📝 icon
- Deleted link: red strikethrough text "[已删除: 旧标题]"

**Click behavior:**

- Clicking a rendered link calls `onNavigate(id, type)` callback
- Parent component handles panel switching to the target editor
- If current document has unsaved changes, save before navigating

**In MarkdownEditor (edit mode):**

- `[[id|标题]]` displays as plain text
- No special rendering, no popup on click — edit mode is pure text

## Implementation Architecture

### New Files

| File | Responsibility |
|------|---------------|
| `components/common/LinkSuggestionPopup.tsx` | Search popup (input + results list + keyboard nav) |
| `lib/link-parser.ts` | Regex for `[[id\|标题]]` + replacement to HTML (pure function) |
| `lib/link-resolver.ts` | Lookup plan/note metadata by id (reads both stores) |

### Modified Files

| File | Change |
|------|--------|
| `components/common/MarkdownEditor.tsx` | Listen for `@`/`[[` input to trigger popup; handle selection callback to insert text |
| `components/common/MarkdownPreview.tsx` | Pre-render: call link-parser to replace wikilinks with HTML spans; bind click handlers |
| `components/common/MarkdownContextMenu.tsx` | Add "Insert link to plan/note" menu item |
| `lib/markdown-operations.ts` | Add `insertLinkRef` operation (pure function) |
| `PlanEditor.tsx` / `NoteEditor.tsx` | Pass `onNavigate` callback to connect preview clicks to panel switching |
| `PanelRouter.tsx` or equivalent layout component | Coordinate cross-panel navigation — when a link target is a different entity type, switch sidebar panel and load target editor |

### Data Flow

```
Input @/[[ → MarkdownEditor detects trigger → show LinkSuggestionPopup
  → user selects → link-resolver looks up metadata → insert [[id|标题]] into textarea

Preview render → MarkdownPreview calls link-parser to replace wikilinks with <span> HTML
  → user clicks → onNavigate(id, type) → parent switches panel
```

### No Changes To

- Store structures (plans/index.json, notes/index.json unchanged)
- IPC channels (reuses existing store data access)
- File storage layer
