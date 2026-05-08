import {
  wrapBold, wrapItalic, wrapStrikethrough, wrapHighlight, wrapInlineCode,
  toggleHeading, toggleBlockquote, toggleUnorderedList, toggleOrderedList,
  toggleTaskList, insertLink, insertCodeBlock,
  applyOperationToTextarea,
} from '@/lib/markdown-operations'
import type { MarkdownOperation } from '@/lib/markdown-operations'

interface ShortcutDef {
  shift: boolean
  code: string
  op: MarkdownOperation
}

const SHORTCUTS: ShortcutDef[] = [
  { shift: false, code: 'KeyB', op: wrapBold },
  { shift: false, code: 'KeyI', op: wrapItalic },
  { shift: false, code: 'KeyK', op: insertLink },
  { shift: true,  code: 'KeyS', op: wrapStrikethrough },
  { shift: true,  code: 'KeyH', op: wrapHighlight },
  { shift: true,  code: 'KeyK', op: wrapInlineCode },
  { shift: true,  code: 'Digit1', op: toggleHeading(1) },
  { shift: true,  code: 'Digit2', op: toggleHeading(2) },
  { shift: true,  code: 'Digit3', op: toggleHeading(3) },
  { shift: true,  code: 'KeyQ', op: toggleBlockquote },
  { shift: true,  code: 'KeyU', op: toggleUnorderedList },
  { shift: true,  code: 'KeyL', op: toggleOrderedList },
  { shift: true,  code: 'KeyT', op: toggleTaskList },
  { shift: true,  code: 'KeyC', op: insertCodeBlock },
]

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onCursorLineChange?: (lineIndex: number | null) => void
  onContextMenu?: (e: React.MouseEvent<HTMLTextAreaElement>) => void
}

export default function MarkdownEditor({ value, onChange, placeholder, onCursorLineChange, onContextMenu }: MarkdownEditorProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget

    if (e.key === 'Tab') {
      e.preventDefault()
      const start = ta.selectionStart

      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const leading = value.slice(lineStart, start)
        const spacesToRemove = Math.min(2, leading.length - leading.trimStart().length)
        if (spacesToRemove > 0) {
          ta.selectionStart = lineStart
          ta.selectionEnd = lineStart + spacesToRemove
          document.execCommand('delete', false)
        }
      } else {
        document.execCommand('insertText', false, '  ')
      }
      return
    }

    if (e.ctrlKey || e.metaKey) {
      const match = SHORTCUTS.find(s => s.shift === e.shiftKey && s.code === e.code)
      if (match) {
        e.preventDefault()
        const result = match.op(value, ta.selectionStart, ta.selectionEnd)
        applyOperationToTextarea(ta, value, result.text, result.start, result.end)
        return
      }
    }
  }

  return (
    <textarea
      className="w-full h-full bg-transparent text-xs text-white/80 font-mono resize-none outline-none placeholder:text-white/20"
      style={{ userSelect: 'text' }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onSelect={() => {
        if (onCursorLineChange) {
          const textarea = document.activeElement as HTMLTextAreaElement
          const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart)
          const lineIndex = textBeforeCursor.split('\n').length - 1
          onCursorLineChange(lineIndex)
        }
      }}
      onContextMenu={(e) => onContextMenu?.(e)}
      placeholder={placeholder}
      spellCheck={false}
    />
  )
}
