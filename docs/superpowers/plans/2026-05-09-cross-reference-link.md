# Cross-Reference Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add wiki-style `[[id|标题]]` cross-reference links between plans and notes, with `@`/`[[` trigger, context menu entry, and clickable preview rendering.

**Architecture:** New pure-function modules for link parsing and resolving. A new popup component for the search/selection UI. MarkdownEditor detects triggers and notifies parent via callback. PlanEditor/NoteEditor manage popup state and navigation. MarkdownPreview renders links as clickable pills.

**Tech Stack:** React 19, TypeScript, Zustand stores (planStore, noteStore), existing MarkdownEditor textarea pattern

**Key shortcut:** `Ctrl+Shift+R` (R for "reference") — avoids conflict with existing `Ctrl+Shift+L` (ordered list).

---

### Task 1: Link parser utility

**Files:**
- Create: `src/renderer/src/lib/link-parser.ts`

This module provides pure functions for parsing and replacing `[[id|标题]]` patterns in Markdown text.

- [ ] **Step 1: Create `link-parser.ts`**

```ts
const WIKILINK_REGEX = /\[\[([a-zA-Z0-9_-]{6,21})\|([^\]]*)\]\]/g

export interface ParsedLink {
  id: string
  title: string
  fullMatch: string
  index: number
}

export function parseLinks(text: string): ParsedLink[] {
  const links: ParsedLink[] = []
  let match
  while ((match = WIKILINK_REGEX.exec(text)) !== null) {
    links.push({
      id: match[1],
      title: match[2],
      fullMatch: match[0],
      index: match.index,
    })
  }
  return links
}

export type LinkType = 'plan' | 'note' | 'deleted'

export interface ResolvedLink {
  id: string
  title: string
  type: LinkType
}

export function replaceLinksWithHtml(
  text: string,
  resolvedLinks: Map<string, ResolvedLink>,
): string {
  return text.replace(WIKILINK_REGEX, (_fullMatch, id: string, _title: string) => {
    const resolved = resolvedLinks.get(id)
    if (!resolved) {
      return `<span class="wikilink wikilink-deleted" data-link-id="${id}">[已删除]</span>`
    }
    const icon = resolved.type === 'plan' ? '📄' : '📝'
    const cssClass = resolved.type === 'plan' ? 'wikilink-plan' : 'wikilink-note'
    return `<span class="wikilink ${cssClass}" data-link-id="${id}" data-link-type="${resolved.type}">${icon} ${escapeHtml(resolved.title)}</span>`
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors related to `link-parser.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/lib/link-parser.ts
git commit -m "feat: add wikilink parser utility"
```

---

### Task 2: Link resolver utility

**Files:**
- Create: `src/renderer/src/lib/link-resolver.ts`

Resolves ids to plan/note metadata by reading both stores.

- [ ] **Step 1: Create `link-resolver.ts`**

```ts
import { usePlanStore } from '@/stores/planStore'
import { useNoteStore } from '@/stores/noteStore'
import type { ResolvedLink } from './link-parser'

export interface LinkSearchResult {
  id: string
  title: string
  type: 'plan' | 'note'
  tags: string[]
}

export function resolveLinks(ids: string[]): Map<string, ResolvedLink> {
  const map = new Map<string, ResolvedLink>()
  const plans = usePlanStore.getState().plans
  const notes = useNoteStore.getState().notes

  for (const id of ids) {
    const plan = plans.find(p => p.id === id)
    if (plan) {
      map.set(id, { id, title: plan.title, type: 'plan' })
      continue
    }
    const note = notes.find(n => n.id === id)
    if (note) {
      map.set(id, { id, title: note.title, type: 'note' })
      continue
    }
  }
  return map
}

export function searchLinks(query: string): LinkSearchResult[] {
  const q = query.toLowerCase().trim()
  const plans = usePlanStore.getState().plans
  const notes = useNoteStore.getState().notes

  const results: LinkSearchResult[] = []

  for (const p of plans) {
    if (!q || p.title.toLowerCase().includes(q)) {
      results.push({ id: p.id, title: p.title, type: 'plan', tags: p.tags ?? [] })
    }
  }
  for (const n of notes) {
    if (!q || n.title.toLowerCase().includes(q)) {
      results.push({ id: n.id, title: n.title, type: 'note', tags: n.tags ?? [] })
    }
  }

  return results.slice(0, 10)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors related to `link-resolver.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/lib/link-resolver.ts
git commit -m "feat: add link resolver for plan/note lookup"
```

---

### Task 3: LinkSuggestionPopup component

**Files:**
- Create: `src/renderer/src/components/common/LinkSuggestionPopup.tsx`

The search popup that appears when user types `@` or `[[`, or triggers via context menu/shortcut.

- [ ] **Step 1: Create `LinkSuggestionPopup.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { searchLinks, type LinkSearchResult } from '@/lib/link-resolver'
import { FileText, StickyNote } from 'lucide-react'

interface LinkSuggestionPopupProps {
  anchorRect: { x: number; y: number }
  onSelect: (result: LinkSearchResult) => void
  onClose: () => void
}

export default function LinkSuggestionPopup({ anchorRect, onSelect, onClose }: LinkSuggestionPopupProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LinkSearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setResults(searchLinks(''))
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const r = searchLinks(query)
    setResults(r)
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        onSelect(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [results, selectedIndex, onSelect, onClose])

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: anchorRect.x,
        top: anchorRect.y,
        zIndex: 10000,
        width: 280,
        maxHeight: 320,
        background: 'rgba(40, 40, 44, 0.98)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索计划或笔记..."
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          color: 'var(--text-primary)',
          fontSize: 12,
          outline: 'none',
        }}
      />
      <div
        ref={listRef}
        style={{
          overflowY: 'auto',
          maxHeight: 270,
          padding: '4px 0',
        }}
      >
        {results.length === 0 && (
          <div style={{ padding: '12px', color: 'var(--text-quaternary)', fontSize: 12, textAlign: 'center' }}>
            无匹配结果
          </div>
        )}
        {results.map((r, i) => (
          <div
            key={`${r.type}-${r.id}`}
            onClick={() => onSelect(r)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              background: i === selectedIndex ? 'rgba(10,132,255,0.15)' : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            {r.type === 'plan' ? (
              <FileText size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
            ) : (
              <StickyNote size={13} style={{ color: '#c084fc', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.title}
            </span>
            {r.tags.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-quaternary)', flexShrink: 0 }}>
                {r.tags.slice(0, 2).join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors related to `LinkSuggestionPopup.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/common/LinkSuggestionPopup.tsx
git commit -m "feat: add LinkSuggestionPopup component"
```

---

### Task 4: Insert link operation in markdown-operations

**Files:**
- Modify: `src/renderer/src/lib/markdown-operations.ts`

Add a pure function for inserting a `[[id|标题]]` reference at cursor position.

- [ ] **Step 1: Add `createInsertLinkRef` after `createInsertImageWithPath` (around line 190)**

```ts
export function createInsertLinkRef(id: string, title: string): MarkdownOperation {
  return (text, start, _end): OperationResult => {
    const inserted = `[[${id}|${title}]]`
    const newPos = start + inserted.length
    return {
      text: text.substring(0, start) + inserted + text.substring(start),
      start: newPos,
      end: newPos,
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/lib/markdown-operations.ts
git commit -m "feat: add createInsertLinkRef markdown operation"
```

---

### Task 5: MarkdownEditor — trigger detection

**Files:**
- Modify: `src/renderer/src/components/common/MarkdownEditor.tsx`

MarkdownEditor detects `@`/`[[` input and calls a prop to notify the parent. It does NOT render the popup itself.

- [ ] **Step 1: Add `onTriggerLinkPopup` prop to interface**

Add to `MarkdownEditorProps`:

```ts
  onTriggerLinkPopup?: (triggerStart: number) => void
```

- [ ] **Step 2: Add `handleTextChanged` wrapper**

Add this function after `handleKeyDown`:

```ts
  const handleTextChanged = useCallback((newValue: string) => {
    const ta = document.activeElement as HTMLTextAreaElement | null
    if (!ta) { onChange(newValue); return }

    const cursorPos = ta.selectionStart
    if (cursorPos < 1) { onChange(newValue); return }

    const charBefore = newValue[cursorPos - 1]
    const charBefore2 = cursorPos >= 2 ? newValue[cursorPos - 2] : ''

    if (charBefore === '@' || (charBefore === '[' && charBefore2 === '[')) {
      const triggerLen = charBefore === '@' ? 1 : 2
      const beforeTrigger = newValue.substring(0, cursorPos - triggerLen)
      if (beforeTrigger.length === 0 || /[\s\n]$/.test(beforeTrigger)) {
        onTriggerLinkPopup?.(cursorPos - triggerLen)
      }
    }

    onChange(newValue)
  }, [onChange, onTriggerLinkPopup])
```

- [ ] **Step 3: Update textarea onChange**

Replace `onChange={(e) => onChange(e.target.value)}` with:
```tsx
onChange={(e) => handleTextChanged(e.target.value)}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/common/MarkdownEditor.tsx
git commit -m "feat: add @/[[ trigger detection to MarkdownEditor"
```

---

### Task 6: MarkdownPreview — render wikilinks as clickable spans

**Files:**
- Modify: `src/renderer/src/components/common/MarkdownPreview.tsx`

Before rendering markdown, resolve all `[[id|标题]]` patterns and replace with styled HTML spans. Add click handler for navigation.

- [ ] **Step 1: Add imports**

```ts
import { parseLinks, replaceLinksWithHtml } from '@/lib/link-parser'
import { resolveLinks } from '@/lib/link-resolver'
```

- [ ] **Step 2: Update props**

```ts
interface MarkdownPreviewProps {
  content: string
  mdFilePath?: string
  onLinkClick?: (id: string, type: string) => void
}
```

Update function signature to destructure `onLinkClick`.

- [ ] **Step 3: Add link resolution and content processing**

After the `imageMap` state, add:

```ts
  const resolvedLinkMap = useMemo(() => {
    const links = parseLinks(content)
    if (links.length === 0) return new Map<string, any>()
    const ids = [...new Set(links.map(l => l.id))]
    return resolveLinks(ids)
  }, [content])
```

Modify the `html` useMemo — replace `content` with `processedContent`:

```ts
  const processedContent = useMemo(() => {
    if (resolvedLinkMap.size === 0) return content
    return replaceLinksWithHtml(content, resolvedLinkMap)
  }, [content, resolvedLinkMap])

  const html = useMemo(() => {
    marked.use({ renderer, gfm: true, breaks: true })
    return marked.parse(processedContent, { async: false }) as string
  }, [processedContent, renderer])
```

- [ ] **Step 4: Add click handler and style injection**

Add before the return:

```ts
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('.wikilink') as HTMLElement | null
    if (!target) return
    const id = target.dataset.linkId
    const type = target.dataset.linkType
    if (id && type && onLinkClick) {
      e.preventDefault()
      e.stopPropagation()
      onLinkClick(id, type)
    }
  }, [onLinkClick])

  useEffect(() => {
    const id = 'wikilink-styles'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      .wikilink { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 4px; cursor: pointer; font-size: 0.9em; transition: background 0.15s; }
      .wikilink-plan { background: rgba(96,165,250,0.15); color: #60a5fa; }
      .wikilink-note { background: rgba(192,132,252,0.15); color: #c084fc; }
      .wikilink-deleted { background: rgba(239,68,68,0.12); color: #ef4444; text-decoration: line-through; }
      .wikilink:hover { filter: brightness(1.2); }
    `
    document.head.appendChild(style)
  }, [])
```

Update the return to include `onClick={handleClick}`:

```tsx
  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  )
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/common/MarkdownPreview.tsx
git commit -m "feat: render wikilinks as clickable pills in MarkdownPreview"
```

---

### Task 7: MarkdownContextMenu — add link insertion menu item

**Files:**
- Modify: `src/renderer/src/components/ui/MarkdownContextMenu.tsx`

Add "链接引用" to the Insert Elements submenu.

- [ ] **Step 1: Add `onInsertLinkRef` prop**

Add to `MarkdownContextMenuProps`:

```ts
  onInsertLinkRef?: () => void
```

- [ ] **Step 2: Add menu item**

In the "插入元素" submenu array, add after "图片" and before "代码块":

```ts
        { label: '链接引用', icon: <LinkIcon size={13} />, shortcut: '⌘⇧R', onClick: () => { onInsertLinkRef?.(); onClose() } },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ui/MarkdownContextMenu.tsx
git commit -m "feat: add link reference item to context menu"
```

---

### Task 8: SplitPaneLiveEditor — pass through link popup prop

**Files:**
- Modify: `src/renderer/src/components/common/SplitPaneLiveEditor.tsx`

Pass `onTriggerLinkPopup` through to the inner MarkdownEditor.

- [ ] **Step 1: Add prop to interface and pass through**

Read `SplitPaneLiveEditor.tsx` to see its props interface. Add:

```ts
  onTriggerLinkPopup?: (triggerStart: number) => void
```

Pass it to the inner `<MarkdownEditor>` component.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/common/SplitPaneLiveEditor.tsx
git commit -m "feat: pass through link popup trigger in SplitPaneLiveEditor"
```

---

### Task 9: PlanEditor — link popup and navigation

**Files:**
- Modify: `src/renderer/src/components/planner/PlanEditor.tsx`

PlanEditor manages the link suggestion popup state, renders it, and handles navigation on link click.

- [ ] **Step 1: Add imports**

```ts
import LinkSuggestionPopup from '@/components/common/LinkSuggestionPopup'
import { createInsertLinkRef } from '@/lib/markdown-operations'
import { type LinkSearchResult } from '@/lib/link-resolver'
import { useNoteStore } from '@/stores/noteStore'
import { usePetStore } from '@/stores/petStore'
```

Note: `applyOperationToTextarea` is already imported on line 14.

- [ ] **Step 2: Add link popup state**

After existing state declarations:

```ts
  const [linkPopupState, setLinkPopupState] = useState<{
    anchorRect: { x: number; y: number }
    triggerStart: number
  } | null>(null)
```

- [ ] **Step 3: Add handlers**

```ts
  const handleTriggerLinkPopup = useCallback((triggerStart: number) => {
    if (!textareaEl) return
    const rect = textareaEl.getBoundingClientRect()
    const lineHeight = 18
    const textBefore = content.substring(0, triggerStart)
    const lineCount = textBefore.split('\n').length - 1
    setLinkPopupState({
      anchorRect: {
        x: rect.left + 10,
        y: rect.top + Math.min(lineCount * lineHeight, rect.height - 50),
      },
      triggerStart,
    })
  }, [textareaEl, content])

  const handleLinkSelect = useCallback((result: LinkSearchResult) => {
    if (!linkPopupState || !textareaEl) return
    const triggerStart = linkPopupState.triggerStart
    const currentCursorPos = textareaEl.selectionStart
    const cleanedText = content.substring(0, triggerStart) + content.substring(currentCursorPos)
    const op = createInsertLinkRef(result.id, result.title)
    const opResult = op(cleanedText, triggerStart, triggerStart)
    applyOperationToTextarea(textareaEl, content, opResult.text, opResult.start, opResult.end)
    setLinkPopupState(null)
  }, [linkPopupState, textareaEl, content])

  const handleLinkPopupClose = useCallback(() => {
    if (!linkPopupState || !textareaEl) { setLinkPopupState(null); return }
    const triggerStart = linkPopupState.triggerStart
    const currentCursorPos = textareaEl.selectionStart
    const triggerLen = currentCursorPos - triggerStart
    if (triggerLen > 0 && triggerLen <= 2) {
      const cleaned = content.substring(0, triggerStart) + content.substring(currentCursorPos)
      applyOperationToTextarea(textareaEl, content, cleaned, triggerStart, triggerStart)
    }
    setLinkPopupState(null)
  }, [linkPopupState, textareaEl, content])

  const handleLinkClick = useCallback((id: string, type: string) => {
    if (type === 'plan') {
      setActivePlan(id)
    } else if (type === 'note') {
      useNoteStore.getState().setActiveNote(id)
      usePetStore.getState().setActivePanel('notes')
    }
  }, [setActivePlan])
```

- [ ] **Step 4: Wire into components**

Add `onTriggerLinkPopup={handleTriggerLinkPopup}` to `<MarkdownEditor>`:

```tsx
          <MarkdownEditor
            value={content}
            onChange={handleChange}
            placeholder="# 计划内容\n\n- [ ] 待办项 1\n- [ ] 待办项 2"
            onContextMenu={handleEditorContextMenu}
            mdFilePath={plan.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
            onTriggerLinkPopup={handleTriggerLinkPopup}
          />
```

Add `onLinkClick={handleLinkClick}` to `<MarkdownPreview>`:

```tsx
            <MarkdownPreview content={content} mdFilePath={plan.filePath} onLinkClick={handleLinkClick} />
```

Add `onInsertLinkRef` to `<MarkdownContextMenu>`:

```tsx
        <MarkdownContextMenu
          {/* ... existing props unchanged ... */}
          onInsertImage={handleInsertImageFromPicker}
          onInsertLinkRef={() => handleTriggerLinkPopup(textareaEl?.selectionStart ?? 0)}
        />
```

- [ ] **Step 5: Render LinkSuggestionPopup**

Add after the existing context menu portal:

```tsx
      {linkPopupState && createPortal(
        <LinkSuggestionPopup
          anchorRect={linkPopupState.anchorRect}
          onSelect={handleLinkSelect}
          onClose={handleLinkPopupClose}
        />,
        document.body,
      )}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/planner/PlanEditor.tsx
git commit -m "feat: wire link popup and navigation into PlanEditor"
```

---

### Task 10: NoteEditor — link popup and navigation

**Files:**
- Modify: `src/renderer/src/components/notes/NoteEditor.tsx`

Same pattern as Task 9 but for the note editor.

- [ ] **Step 1: Add imports**

```ts
import LinkSuggestionPopup from '@/components/common/LinkSuggestionPopup'
import { createInsertLinkRef } from '@/lib/markdown-operations'
import { type LinkSearchResult } from '@/lib/link-resolver'
import { usePlanStore } from '@/stores/planStore'
import { usePetStore } from '@/stores/petStore'
```

Note: `applyOperationToTextarea` is already imported on line 17.

- [ ] **Step 2: Add link popup state and handlers**

Same `linkPopupState`, `handleTriggerLinkPopup`, `handleLinkSelect`, `handleLinkPopupClose` as PlanEditor Task 9.

Key difference in `handleLinkClick`:

```ts
  const handleLinkClick = useCallback((id: string, type: string) => {
    if (type === 'note') {
      setActiveNote(id)
    } else if (type === 'plan') {
      usePlanStore.getState().setActivePlan(id)
      usePetStore.getState().setActivePanel('planner')
    }
  }, [setActiveNote])
```

- [ ] **Step 3: Wire into all editor variants**

Add `onTriggerLinkPopup={handleTriggerLinkPopup}` to:
- `<MarkdownEditor>` in edit mode
- `<SplitPaneLiveEditor>` in live mode

Add `onLinkClick={handleLinkClick}` to:
- `<MarkdownPreview>` in preview mode
- The preview pane inside `<SplitPaneLiveEditor>` (if it renders its own MarkdownPreview — check the component)

Add `onInsertLinkRef` to `<MarkdownContextMenu>`.

- [ ] **Step 4: Render LinkSuggestionPopup**

Same as PlanEditor Task 9 Step 5.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd d:/hpl/projects/fun-pets && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/notes/NoteEditor.tsx
git commit -m "feat: wire link popup and navigation into NoteEditor"
```

---

### Task 11: Manual testing and edge cases

- [ ] **Step 1: Build and run the app**

Run: `cd d:/hpl/projects/fun-pets && npm run dev`

- [ ] **Step 2: Test `@` trigger**

Open a plan or note in edit mode. Type `@` at the start of a line. Verify popup appears with search results. Select one. Verify `[[id|标题]]` is inserted and `@` is removed.

- [ ] **Step 3: Test `[[` trigger**

Type `[[` at start of a line. Verify popup appears. Select one. Verify insertion works and `[[` is removed.

- [ ] **Step 4: Test trigger guard**

Type `foo@bar` — verify no popup. Type `[text](url)` — verify no popup.

- [ ] **Step 5: Test context menu**

Right-click in editor. Verify "插入元素 → 链接引用" appears. Click it. Verify popup appears.

- [ ] **Step 6: Test preview rendering**

Switch to preview mode. Verify `[[id|标题]]` renders as colored pill badges with correct icons.

- [ ] **Step 7: Test navigation**

Click a rendered plan link in a note. Verify it switches to planner panel and opens the plan. Click a rendered note link in a plan. Verify it switches to notes panel and opens the note.

- [ ] **Step 8: Test deleted link**

Manually edit markdown to reference a non-existent id like `[[zzzzzzz|已删除的文档]]`. Verify it renders as red strikethrough in preview.

- [ ] **Step 9: Final commit if any fixes needed**

```bash
git add -A
git commit -m "feat: complete cross-reference link feature"
```
