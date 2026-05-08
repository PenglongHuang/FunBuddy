# Markdown 右键上下文菜单 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在笔记编辑器（edit/live/preview 三种模式）中实现文本选择 + Obsidian 级右键 Markdown 快捷操作菜单。

**Architecture:** 扩展现有 ContextMenu 组件支持子菜单；新建纯函数库 markdown-operations.ts 处理所有格式化逻辑；新建 useTextSelection hook 检测 textarea 选区；新建 MarkdownContextMenu 组件生成菜单项并集成到 NoteEditor。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 + motion/framer-motion + Zustand + Electron 36

**Spec:** [2026-05-08-markdown-context-menu-design.md](../specs/2026-05-08-markdown-context-menu-design.md)

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/renderer/src/lib/markdown-operations.ts` | **新建** | 所有 MD 格式化纯函数（wrap/linePrefix/block 三类） |
| `src/renderer/src/hooks/useTextSelection.ts` | **新建** | textarea 选区检测 hook |
| `src/renderer/src/components/ui/ContextMenu.tsx` | **修改** | 增加 submenu / disabled / shortcut / isGroupHeader 支持 |
| `src/renderer/src/components/ui/MarkdownContextMenu.tsx` | **新建** | 编辑器右键菜单组件（生成菜单项，处理点击） |
| `src/renderer/src/components/notes/NoteEditor.tsx` | **修改** | 集成右键菜单（edit/live/preview 三模式） |
| `src/renderer/src/components/common/MarkdownEditor.tsx` | **修改** | 添加 onContextMenu prop + userSelect:text |
| `src/renderer/src/components/ui/index.ts` | **修改** | 导出 MarkdownContextMenu |

---

### Task 1: markdown-operations.ts — 格式化纯函数库

**Files:**
- Create: `src/renderer/src/lib/markdown-operations.ts`
- Test: 无（纯函数，由 Task 5 集成测试覆盖）

- [ ] **Step 1: 创建文件并定义类型**

```typescript
// src/renderer/src/lib/markdown-operations.ts

export interface OperationResult {
  text: string
  start: number
  end: number
}

export type MarkdownOperation = (text: string, start: number, end: number) => OperationResult
```

- [ ] **Step 2: 实现包裹型（wrap）通用函数**

```typescript
function wrapWith(text: string, start: number, end: number, marker: string): OperationResult {
  const selected = text.substring(start, end)
  const wrapped = `${marker}${selected}${marker}`
  // Toggle: 如果选区外层已有该标记符则移除
  if (
    start >= marker.length &&
    end <= text.length - marker.length &&
    text.substring(start - marker.length, start) === marker &&
    text.substring(end, end + marker.length) === marker
  ) {
    return {
      text: text.substring(0, start - marker.length) + selected + text.substring(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    }
  }
  return {
    text: text.substring(0, start) + wrapped + text.substring(end),
    start: start + marker.length,
    end: end + marker.length,
  }
}

export const wrapBold = (text: string, start: number, end: number) =>
  wrapWith(text, start, end, '**')

export const wrapItalic = (text: string, start: number, end: number) =>
  wrapWith(text, start, end, '*')

export const wrapStrikethrough = (text: string, start: number, end: number) =>
  wrapWith(text, start, end, '~~')

export const wrapHighlight = (text: string, start: number, end: number) =>
  wrapWith(text, start, end, '==')

export const wrapInlineCode = (text: string, start: number, end: number) =>
  wrapWith(text, start, end, '`')
```

- [ ] **Step 3: 实现行首插入（linePrefix）通用函数**

```typescript
function getLineStart(text: string, pos: number): number {
  const i = text.lastIndexOf('\n', pos - 1)
  return i === -1 ? 0 : i + 1
}

function getLineEnd(text: string, pos: number): number {
  const i = text.indexOf('\n', pos)
  return i === -1 ? text.length : i
}

function toggleLinePrefix(text: string, pos: number, prefix: string): OperationResult {
  const lineStart = getLineStart(text, pos)
  const lineEnd = getLineEnd(text, pos)
  const lineContent = text.substring(lineStart, lineEnd)

  if (lineContent.startsWith(prefix)) {
    // 移除前缀
    const newLine = lineContent.substring(prefix.length)
    return {
      text: text.substring(0, lineStart) + newLine + text.substring(lineEnd),
      start: lineStart,
      end: lineStart + newLine.length,
    }
  }

  // 添加前缀
  const newLine = prefix + lineContent
  return {
    text: text.substring(0, lineStart) + newLine + text.substring(lineEnd),
    start: lineStart + prefix.length,
    end: lineStart + newLine.length,
  }
}
```

- [ ] **Step 4: 实现段落样式操作函数**

```typescript
export function toggleHeading(level: 1 | 2 | 3 | 4 | 5 | 6): MarkdownOperation {
  return (text: string, start: number, _end: number) => {
    const lineStart = getLineStart(text, start)
    const lineEnd = getLineEnd(text, start)
    const lineContent = text.substring(lineStart, lineEnd)

    // 检测当前标题级别
    const headingMatch = lineContent.match(/^(#{1,6})\s+(.*)/)
    if (headingMatch) {
      const currentLevel = headingMatch[1].length
      const rest = headingMatch[2]

      if (currentLevel === level) {
        // 同级别 → 移除标题标记
        return { text: text.substring(0, lineStart) + rest + text.substring(lineEnd), start: lineStart, end: lineStart + rest.length }
      }

      // 不同级别 → 替换为新级别
      const newPrefix = '#'.repeat(level) + ' '
      const newLine = newPrefix + rest
      return { text: text.substring(0, lineStart) + newLine + text.substring(lineEnd), start: lineStart + newPrefix.length, end: lineStart + newLine.length }
    }

    // 无标题 → 添加指定级别
    const prefix = '#'.repeat(level) + ' '
    const newLine = prefix + lineContent.trimStart()
    return { text: text.substring(0, lineStart) + newLine + text.substring(lineEnd), start: lineStart + prefix.length, end: lineStart + newLine.length }
  }
}

export const toggleBlockquote: MarkdownOperation = (text, start, _end) =>
  toggleLinePrefix(text, start, '> ')

export const toggleUnorderedList: MarkdownOperation = (text, start, _end) =>
  toggleLinePrefix(text, start, '- ')

export const toggleOrderedList: MarkdownOperation = (text, start, _end) =>
  toggleLinePrefix(text, start, '1. ')

export const toggleTaskList: MarkdownOperation = (text, start, _end) =>
  toggleLinePrefix(text, start, '- [ ] ')
```

- [ ] **Step 5: 实现块级插入操作函数**

```typescript
export const insertLink: MarkdownOperation = (text, start, end) => {
  const selected = text.substring(start, end)
  const linkText = selected || 'text'
  const inserted = `[${linkText}](url)`
  return {
    text: text.substring(0, start) + inserted + text.substring(end),
    start: start + 1,
    end: start + 1 + linkText.length,
  }
}

export const insertTable: MarkdownOperation = (text, start, _end) => {
  const template = '\n| 列1 | 列2 |\n| --- | --- |\n|  |  |\n'
  return {
    text: text.substring(0, start) + template + text.substring(start),
    start: start + template.length,
    end: start + template.length,
  }
}

export const insertHorizontalRule: MarkdownOperation = (text, start, _end) => {
  const hr = '\n---\n'
  return {
    text: text.substring(0, start) + hr + text.substring(start),
    start: start + hr.length,
    end: start + hr.length,
  }
}

export const insertImage: MarkdownOperation = (text, start, _end) => {
  const inserted = '![alt](url)'
  return {
    text: text.substring(0, start) + inserted + text.substring(start),
    start: start + 2,
    end: start + 5, // 选中 "alt"
  }
}

export const insertCodeBlock: MarkdownOperation = (text, start, end) => {
  const selected = text.substring(start, end)
  const code = selected || 'code'
  const inserted = '```\n' + code + '\n```'
  return {
    text: text.substring(0, start) + inserted + text.substring(end),
    start: start + 4,
    end: start + 4 + code.length,
  }
}
```

- [ ] **Step 6: 实现基础编辑辅助函数**

```typescript
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export async function pasteFromClipboard(): Promise<string> {
  return await navigator.clipboard.readText()
}
```

- [ ] **Step 7: 验证 — 在浏览器控制台快速测试**

打开 DevTools Console，import 后调用各函数验证输入输出：

```typescript
// 测试 wrapBold toggle
wrapBold('hello world', 0, 11)        // → "**hello world**"
wrapBold('**hello**', 0, 9)           // → "hello" (toggle off)

// 测试 toggleHeading 循环
toggleHeading(1)('hello', 0, 5)       // → "# hello"
toggleHeading(2)('# hello', 0, 7)     // → "## hello"

// 测试 insertLink 有选中文字
insertLink('click here', 0, 10)       // → "[click here](url)"
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/lib/markdown-operations.ts
git commit -m "feat: add markdown formatting operations library"
```

---

### Task 2: useTextSelection Hook

**Files:**
- Create: `src/renderer/src/hooks/useTextSelection.ts`

- [ ] **Step 1: 创建 hook 文件**

```typescript
// src/renderer/src/hooks/useTextSelection.ts
import { useRef, useState, useCallback, useEffect } from 'react'

export interface TextSelectionState {
  selectedText: string
  selection: { start: number; end: number }
  hasSelection: boolean
  currentLine: string
  lineIndex: number
}

export default function useTextSelection(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
): TextSelectionState {
  const [state, setState] = useState<TextSelectionState>({
    selectedText: '',
    selection: { start: 0, end: 0 },
    hasSelection: false,
    currentLine: '',
    lineIndex: 0,
  })

  const rafRef = useRef<number>(0)

  const updateSelection = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return

    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selectedText = ta.value.substring(start, end)

    // 获取当前行
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
    const lineEnd = ta.value.indexOf('\n', start)
    const currentLine = ta.value.substring(lineStart, lineEnd === -1 ? undefined : lineEnd)
    const lineIndex = ta.value.substring(0, lineStart).split('\n').length - 1

    setState({
      selectedText,
      selection: { start, end },
      hasSelection: start !== end,
      currentLine,
      lineIndex,
    })
  }, [textareaRef])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return

    const events = ['select', 'keyup', 'mouseup', 'focus'] as const
    const handler = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(updateSelection)
    }

    events.forEach((e) => ta.addEventListener(e, handler))
    updateSelection() // 初始状态

    return () => {
      cancelAnimationFrame(rafRef.current)
      events.forEach((e) => ta.removeEventListener(e, handler))
    }
  }, [textareaRef, updateSelection])

  return state
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/hooks/useTextSelection.ts
git commit -m "feat: add useTextSelection hook for textarea selection tracking"
```

---

### Task 3: ContextMenu 组件增强 — 子菜单支持

**Files:**
- Modify: `src/renderer/src/components/ui/ContextMenu.tsx`

- [ ] **Step 1: 扩展 ContextMenuItem 接口**

在现有接口定义处添加新字段：

```typescript
interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  danger?: boolean
  textColor?: string
  hoverColor?: string
  onClick: () => void
  submenu?: ContextMenuItem[]   // 新增：子菜单
  disabled?: boolean            // 新增：禁用状态
  shortcut?: string             // 新增：快捷键展示文本
  isGroupHeader?: boolean       // 新增：分组标题
}
```

- [ ] **Step 2: 实现 group header 渲染**

在 items map 循环内，对 `isGroupHeader` 项渲染为不可点击的分组标题：

```tsx
// 在现有 return 的 <div key={i}> 内部：
if (item.isGroupHeader) {
  return (
    <div key={i}>
      {showSeparator && <div style={{ height: 0.5, background: 'rgba(255,255,255,0.08)', margin: '2px 8px' }} />}
      <div style={{
        padding: '6px 12px',
        color: 'rgba(255,255,255,0.35)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.8px',
        textTransform: 'uppercase' as const,
        pointerEvents: 'none' as const,
      }}>
        {item.label}
      </div>
    </div>
  )
}
```

注意：group header 不影响 `hadDanger` 分隔线逻辑。

- [ ] **Step 3: 实现 disabled 样式和 shortcut 显示**

修改 item button 的渲染：

```tsx
<button
  onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
  onMouseEnter={(e) => {
    if (item.disabled) return
    e.currentTarget.style.background = item.danger
      ? 'rgba(255,55,95,0.1)'
      : item.hoverColor ?? 'rgba(255,255,255,0.06)'
  }}
  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
  style={{
    ...itemStyle(item.danger ? 'rgba(255,55,95,0.8)' : item.textColor),
    opacity: item.disabled ? 0.35 : 1,
    cursor: item.disabled ? 'not-allowed' : 'pointer',
    pointerEvents: item.disabled ? 'none' as const : 'auto' as const,
  }}
>
  {item.icon}
  <span style={{ flex: 1 }}>{item.label}</span>
  {item.shortcut && (
    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 16 }}>
      {item.shortcut}
    </span>
  )}
  {/* submenu arrow */}
  {item.submenu && item.submenu.length > 0 && (
    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>▸</span>
  )}
</button>
```

- [ ] **Step 4: 实现子菜单组件（SubmenuPanel）**

在同一文件中创建内部子组件：

```tsx
function SubmenuPanel({
  items,
  parentRect,
  onClose,
}: {
  items: ContextMenuItem[]
  parentRect: DOMRect
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // 防溢出定位
  const submenuStyle: React.CSSProperties = useMemo(() => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const menuWidth = 160
    const menuHeight = Math.min(items.length * 36 + 8, 400)

    let right = viewportWidth - parentRect.right + 4 // 默认右侧展开
    let top = parentRect.top

    // 右侧放不下 → 向左展开
    if (parentRect.right + menuWidth > viewportWidth - 8) {
      right = viewportWidth - parentRect.left + menuWidth + 4
    }

    // 底部放不下 → 向上偏移
    if (top + menuHeight > viewportHeight - 8) {
      top = viewportHeight - menuHeight - 8
    }

    return {
      position: 'fixed' as const,
      top,
      right,
      ...menuContainerStyle,
      minWidth: 140,
    }
  }, [items.length, parentRect])

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        style={submenuStyle}
        initial={{ opacity: 0, scale: 0.95, x: -4 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.95, x: -4 }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        {items.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
              onMouseEnter={(e) => {
                if (item.disabled) return
                e.currentTarget.style.background = item.hoverColor ?? 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              style={{
                ...itemStyle(item.textColor),
                opacity: item.disabled ? 0.35 : 1,
                cursor: item.disabled ? 'not-allowed' as const : 'pointer' as const,
              }}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.shortcut && (
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 16 }}>
                  {item.shortcut}
                </span>
              )}
            </button>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 5: 在主菜单中集成子菜单 hover 触发**

在 ContextMenu 主组件中增加 submenu 状态管理：

```tsx
const [activeSubmenu, setActiveSubmenu] = useState<ContextMenuItem[] | null>(null)
const [submenuAnchor, setSubmenuAnchor] = useState<DOMRect | null>(null)

// 在带 submenu 的 item 的 onMouseEnter 中：
onMouseEnter={(e) => {
  if (item.submenu) {
    setActiveSubmenu(item.submenu)
    setSubmenuAnchor(e.currentTarget.getBoundingClientRect())
  } else {
    setActiveSubmenu(null)
  }
  // ... 原有 hover 样式
}}

// 在主菜单的 motion.div 之后渲染 SubmenuPortal：
{activeSubmenu && submenuAnchor && createPortal(
  <SubmenuPanel
    items={activeSubmenu}
    parentRect={submenuAnchor}
    onClose={onClose}
  />,
  document.body
)}
```

需要在文件顶部添加 `createPortal` import 和 `useState` import。

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/ui/ContextMenu.tsx
git commit -m "feat: enhance ContextMenu with submenu, disabled, shortcut, and group header support"
```

---

### Task 4: MarkdownContextMenu 组件

**Files:**
- Create: `src/renderer/src/components/ui/MarkdownContextMenu.tsx`
- Modify: `src/renderer/src/components/ui/index.ts` (添加导出)

- [ ] **Step 1: 创建 MarkdownContextMenu 组件骨架**

```typescript
// src/renderer/src/components/ui/MarkdownContextMenu.tsx
import { useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import ContextMenu from './ContextMenu'
import {
  copyToClipboard, pasteFromClipboard,
  wrapBold, wrapItalic, wrapStrikethrough, wrapHighlight,
  toggleHeading, toggleBlockquote, toggleUnorderedList, toggleOrderedList, toggleTaskList,
  insertLink, insertTable, insertHorizontalRule, insertImage, insertCodeBlock,
} from '@/lib/markdown-operations'
import { Bold, Italic, Strikethrough, Highlighter, Type, Quote, List, ListOrdered, CheckSquare, Link, Table, Minus, Image, Code, Copy, Clipboard, Scissors, MousePointer2 } from 'lucide-react'

interface MarkdownContextMenuProps {
  anchorRect: DOMRect
  onClose: () => void
  mode: 'edit' | 'live' | 'preview'
  // 编辑模式 props
  text: string
  selectionStart: number
  selectionEnd: number
  selectedText: string
  hasSelection: boolean
  onApplyOperation: (newText: string, newStart: number, newEnd: number) => void
  // 预览模式 props
  previewContent?: string
}
```

- [ ] **Step 2: 实现编辑模式菜单项生成**

```typescript
export default function MarkdownContextMenu({
  anchorRect, onClose, mode, text, selectionStart, selectionEnd,
  selectedText, hasSelection, onApplyOperation, previewContent,
}: MarkdownContextMenuProps) {

  const applyOp = useCallback((op: typeof wrapBold) => {
    const result = op(text, selectionStart, selectionEnd)
    onApplyOperation(result.text, result.start, result.end)
  }, [text, selectionStart, selectionEnd, onApplyOperation])

  const editItems = useMemo(() => {
    const items: ContextMenuItem['items'] = []

    // === 基础编辑组 ===
    items.push({ label: '基础编辑', isGroupHeader: true })
    items.push({ label: '复制', icon: <Copy size={13} />, shortcut: '⌘C', disabled: !hasSelection, onClick: () => applyCopy() })
    items.push({ label: '粘贴', icon: <Clipboard size={13} />, shortcut: '⌘V', onClick: () => applyPaste() })
    items.push({ label: '剪切', icon: <Scissors size={13} />, shortcut: '⌘X', disabled: !hasSelection, onClick: () => applyCut() })

    // === 文本格式组 ===
    items.push({ label: '文本格式', isGroupHeader: true })
    items.push({ label: '文本格式', icon: <Type size={13} />,
      submenu: [
        { label: '加粗', icon: <Bold size={13} />, shortcut: '⌘B', disabled: !hasSelection, onClick: () => applyOp(wrapBold) },
        { label: '斜体', icon: <Italic size={13} />, shortcut: '⌘I', disabled: !hasSelection, onClick: () => applyOp(wrapItalic) },
        { label: '删除线', icon: <Strikethrough size={13} />, disabled: !hasSelection, onClick: () => applyOp(wrapStrikethrough) },
        { label: '高亮', icon: <Highlighter size={13} />, disabled: !hasSelection, onClick: () => applyOp(wrapHighlight) },
      ]
    })

    // === 段落样式组 ===
    items.push({ label: '段落样式', isGroupHeader: true })
    items.push({ label: '段落样式', icon: <MousePointer2 size={13} />,
      submenu: [
        { label: '标题 1', onClick: () => applyOp(toggleHeading(1)) },
        { label: '标题 2', onClick: () => applyOp(toggleHeading(2)) },
        { label: '标题 3', onClick: () => applyOp(toggleHeading(3)) },
        { label: '标题 4', onClick: () => applyOp(toggleHeading(4)) },
        { label: '标题 5', onClick: () => applyOp(toggleHeading(5)) },
        { label: '标题 6', onClick: () => applyOp(toggleHeading(6)) },
        { label: '引用块', icon: <Quote size={13} />, onClick: () => applyOp(toggleBlockquote) },
        { label: '无序列表', icon: <List size={13} />, onClick: () => applyOp(toggleUnorderedList) },
        { label: '有序列表', icon: <ListOrdered size={13} />, onClick: () => applyOp(toggleOrderedList) },
        { label: '任务列表', icon: <CheckSquare size={13} />, onClick: () => applyOp(toggleTaskList) },
      ]
    })

    // === 插入元素组 ===
    items.push({ label: '插入元素', isGroupHeader: true })
    items.push({ label: '插入元素', icon: <Link size={13} />,
      submenu: [
        { label: '超链接', icon: <Link size={13} />, onClick: () => applyOp(insertLink) },
        { label: '表格', icon: <Table size={13} />, onClick: () => applyOp(insertTable) },
        { label: '分割线', icon: <Minus size={13} />, onClick: () => applyOp(insertHorizontalRule) },
        { label: '图片', icon: <Image size={13} />, onClick: () => applyOp(insertImage) },
        { label: '代码块', icon: <Code size={13} />, onClick: () => applyOp(insertCodeBlock) },
      ]
    })

    return items
  }, [hasSelection, applyOp])
```

- [ ] **Step 3: 实现基础编辑操作（复制/粘贴/剪切）**

```typescript
  const applyCopy = useCallback(async () => {
    if (selectedText) await copyToClipboard(selectedText)
    onClose()
  }, [selectedText, onClose])

  const applyPaste = useCallback(async () => {
    try {
      const clipText = await pasteFromClipboard()
      onApplyOperation(
        text.substring(0, selectionStart) + clipText + text.substring(selectionEnd),
        selectionStart + clipText.length,
        selectionStart + clipText.length
      )
    } catch { /* 剪贴板不可用 */ }
    onClose()
  }, [text, selectionStart, selectionEnd, onApplyOperation, onClose])

  const applyCut = useCallback(async () => {
    if (selectedText) {
      await copyToClipboard(selectedText)
      onApplyOperation(
        text.substring(0, selectionStart) + text.substring(selectionEnd),
        selectionStart,
        selectionStart
      )
    }
    onClose()
  }, [text, selectedText, selectionStart, selectionEnd, onApplyOperation, onClose])
```

- [ ] **Step 4: 实现预览模式菜单项**

```typescript
  const previewItems = useMemo(() => [
    { label: '复制', icon: <Copy size={13} />, onClick: async () => {
      const sel = window.getSelection()?.toString() || ''
      if (sel) await copyToClipboard(sel)
      onClose()
    }},
    { label: '复制为 Markdown', icon: <Code size={13} />, onClick: async () => {
      if (previewContent) await copyToClipboard(previewContent)
      onClose()
    }},
    { label: '复制 HTML', icon: <Code size={13} />, onClick: async () => {
      const sel = window.getSelection()
      if (sel?.rangeCount) {
        const container = document.createElement('div')
        container.appendChild(sel.getRangeAt(0).cloneContents())
        await copyToClipboard(container.innerHTML)
      }
      onClose()
    }},
  ], [previewContent, onClose])
```

- [ ] **Step 5: 组装渲染逻辑**

```typescript
  const items = mode === 'preview' ? previewItems : editItems

  return createPortal(
    <ContextMenu items={items} anchorRect={anchorRect} onClose={onClose} />,
    document.body
  )
}
```

注意：需要将 `isGroupHeader` 和 `submenu` 字段加入 ContextMenuItem 类型。由于 Task 3 已扩展了 ContextMenu 接口，这里直接使用即可。如果 TypeScript 报类型不匹配，在 MarkdownContextMenu 中使用类型断言或更新 index.ts 导出类型。

- [ ] **Step 6: 更新 UI 组件导出**

在 `src/renderer/src/components/ui/index.ts` 添加：

```typescript
export { default as MarkdownContextMenu } from './MarkdownContextMenu'
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/ui/MarkdownContextMenu.tsx src/renderer/src/components/ui/index.ts
git commit -m "feat: add MarkdownContextMenu component with edit and preview modes"
```

---

### Task 5: 集成到 NoteEditor

**Files:**
- Modify: `src/renderer/src/components/notes/NoteEditor.tsx`
- Modify: `src/renderer/src/components/common/MarkdownEditor.tsx`

- [ ] **Step 1: 修改 MarkdownEditor — 添加 onContextMenu prop**

在 `MarkdownEditorProps` 接口中添加可选的 `onContextMenu` 回调：

```typescript
interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onCursorLineChange?: (lineIndex: number | null) => void
  onContextMenu?: (e: React.MouseEvent<HTMLTextAreaElement>) => void  // 新增
}
```

在 `<textarea>` 上绑定事件和 userSelect 样式：

```tsx
<textarea
  className="w-full h-full bg-transparent text-xs text-white/80 font-mono resize-none outline-none placeholder:text-white/20"
  style={{ userSelect: 'text' }}  // 新增：覆盖全局 none
  value={value}
  onChange={(e) => onChange(e.target.value)}
  onKeyDown={handleKeyDown}
  onSelect={() => { /* ...原有逻辑... */ }}
  onContextMenu={(e) => onContextMenu?.(e)}  // 新增
  placeholder={placeholder}
  spellCheck={false}
/>
```

- [ ] **Step 2: 修改 NoteEditor — 集成右键菜单**

在 NoteEditor 组件中：

a) 添加 imports:

```typescript
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import MarkdownContextMenu from '@/components/ui/MarkdownContextMenu'
import useTextSelection from '@/hooks/useTextSelection'
```

b) 添加菜单状态：

```typescript
const [contextMenuState, setContextMenuState] = useState<{
  anchorRect: DOMRect
  mode: 'edit' | 'live' | 'preview'
} | null>(null)
const textareaRef = useRef<HTMLTextAreaElement>(null)
const selection = useTextSelection(textareaRef)
```

c) 添加右键处理器：

```typescript
const handleEditorContextMenu = useCallback((e: React.MouseEvent) => {
  e.preventDefault()
  setContextMenuState({
    anchorRect: e.currentTarget.getBoundingClientRect(),
    mode,
  })
}, [mode])
```

d) 添加操作执行回调：

```typescript
const handleApplyOperation = useCallback((newText: string, newStart: number, newEnd: number) => {
  handleChange(newText)
  // 延迟设置选区，等 DOM 更新后
  requestAnimationFrame(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.focus()
      ta.setSelectionRange(newStart, newEnd)
    }
  })
  setContextMenuState(null)
}, [handleChange])
```

e) 添加预览区右键处理器：

```typescript
const handlePreviewContextMenu = useCallback((e: React.MouseEvent) => {
  e.preventDefault()
  setContextMenuState({
    anchorRect: (e.target as HTMLElement).getBoundingClientRect(),
    mode: 'preview',
  })
}, [])
```

f) 传递 props 给 MarkdownEditor：

```tsx
<MarkdownEditor
  value={content}
  onChange={handleChange}
  onCursorLineChange={setCurrentLineIndex}
  placeholder="# 标题\n\n内容..."
  onContextMenu={handleEditorContextMenu}
/>
```

g) 给 SplitPaneLiveEditor 中的 MarkdownEditor 也传递 onContextMenu（通过透传）：

SplitPaneLiveEditor 需要新增 `onContextMenu` prop 并传给内部的 MarkdownEditor。

h) 预览模式容器加右键菜单：

```tsx
{mode === 'preview' && (
  <div
    ref={editorRef}
    className="flex-1 min-h-0 overflow-auto"
    style={{ userSelect: 'text' }}  // 允许选择
    onContextMenu={handlePreviewContextMenu}
  >
    <MarkdownPreview content={content} />
  </div>
)}
```

i) 渲染 MarkdownContextMenu Portal：

```tsx
{contextMenuState && rootRef.current && createPortal(
  <MarkdownContextMenu
    anchorRect={contextMenuState.anchorRect}
    onClose={() => setContextMenuState(null)}
    mode={contextMenuState.mode}
    text={content}
    selectionStart={selection.selection.start}
    selectionEnd={selection.selection.end}
    selectedText={selection.selectedText}
    hasSelection={selection.hasSelection}
    onApplyOperation={handleApplyOperation}
    previewContent={content}
  />,
  document.body
)}
```

j) 通过 ref 获取 textarea 引用——由于 MarkdownEditor 是封装组件，需要用 ref 回调或 querySelector 方式获取。最简单的方式是在 editorRef 容器内查找：

```typescript
useEffect(() => {
  if (editorRef.current) {
    const ta = editorRef.current.querySelector('textarea')
    if (ta) textareaRef.current = ta
  }
})
```

或者更优雅地：让 MarkdownEditor 支持 forwardRef。

- [ ] **Step 3: 修改 SplitPaneLiveEditor — 透传 onContextMenu**

```typescript
interface SplitPaneLiveEditorProps {
  value: string
  onChange: (value: string) => void
  onCursorLineChange?: (lineIndex: number | null) => void
  placeholder?: string
  onContextMenu?: (e: React.MouseEvent<HTMLTextAreaElement>) => void  // 新增
}

// 传给 MarkdownEditor:
<MarkdownEditor
  value={value}
  onChange={onChange}
  onCursorLineChange={onCursorLineChange}
  placeholder={placeholder}
  onContextMenu={onContextMenu}  // 新增
/>
```

- [ ] **Step 4: 手动验证**

启动应用 (`npm run dev`) 并验证：

1. 打开一条笔记进入编辑模式
2. 输入一些文字，选中部分文字
3. 右键 → 应弹出暗色玻璃态菜单，包含 4 个分组
4. hover "文本格式" → 右侧滑出子菜单（加粗/斜体/删除线/高亮）
5. 点击"加粗" → 选中文本被 `**` 包裹
6. 再次选中加粗文本，右键→加粗 → toggle 移除 `**`
7. 无选中文本时右键 → 格式化项置灰
8. 切换到 live 模式 → 左侧编辑区右键同样有效
9. 切换到 preview 模式 → 右键只显示"复制/复制为 Markdown/复制 HTML"
10. 预览模式下可选中文字并复制

- [ ] **Step 5: Commit**

```bash
git add \
  src/renderer/src/components/notes/NoteEditor.tsx \
  src/renderer/src/components/common/MarkdownEditor.tsx \
  src/renderer/src/components/common/SplitPaneLiveEditor.tsx
git commit -m "feat: integrate markdown context menu into note editor (edit/live/preview modes)"
```

---

## 任务依赖关系

```
Task 1 (markdown-operations) ─────┐
                                  ├──→ Task 4 (MarkdownContextMenu) ──→ Task 5 (集成)
Task 2 (useTextSelection) ─────────┤
                                  │
Task 3 (ContextMenu 增强) ─────────┘
```

Task 1、2、3 相互独立，可并行开发。
Task 4 依赖 1+3 完成。
Task 5 依赖全部完成。
