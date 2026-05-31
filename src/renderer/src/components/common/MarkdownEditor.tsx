import { useCallback } from 'react'
import {
  wrapBold, wrapItalic, wrapStrikethrough, wrapHighlight, wrapInlineCode,
  toggleHeading, toggleBlockquote, toggleUnorderedList, toggleOrderedList,
  toggleTaskList, insertLink, insertCodeBlock,
  applyOperationToTextarea,
  createInsertImageWithPath,
} from '@/lib/markdown-operations'
import type { MarkdownOperation } from '@/lib/markdown-operations'
import { maskCodeBlocks } from '@/lib/link-parser'
import { imageApi } from '@/lib/ipc'

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
  mdFilePath?: string
  onInsertImageFromPicker?: () => void
  showToast?: (msg: string) => void
  onTriggerLinkPopup?: (triggerStart: number) => void
}

export default function MarkdownEditor({ value, onChange, placeholder, onCursorLineChange, onContextMenu, mdFilePath, onInsertImageFromPicker, showToast, onTriggerLinkPopup }: MarkdownEditorProps) {
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!mdFilePath) return
    const ta = e.currentTarget
    for (const item of Array.from(e.clipboardData.items)) {
      if (!item.type.startsWith('image/')) continue
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      if (file.size > 10 * 1024 * 1024) {
        showToast?.('Image must be under 10 MB')
        return
      }
      try {
        const buffer = await file.arrayBuffer()
        const ext = file.type.split('/')[1] || 'png'
        const altName = file.name.replace(/\.[^.]+$/, '')
        const result = await imageApi.save(mdFilePath, buffer, ext, altName)
        const op = createInsertImageWithPath(result.relativePath, altName)
        const opResult = op(value, ta.selectionStart, ta.selectionEnd)
        applyOperationToTextarea(ta, value, opResult.text, opResult.start, opResult.end)
      } catch (err) {
        showToast?.('Failed to save pasted image')
      }
      return
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (Array.from(e.dataTransfer.items).some(item => item.type.startsWith('image/'))) {
      e.preventDefault()
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (!mdFilePath) return
    const ta = e.currentTarget
    const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    e.preventDefault()

    let currentText = value
    let currentPos = ta.selectionStart

    for (const file of imageFiles) {
      if (file.size > 10 * 1024 * 1024) {
        showToast?.(`Image "${file.name}" must be under 10 MB`)
        continue
      }
      try {
        const buffer = await file.arrayBuffer()
        const ext = file.type.split('/')[1] || 'png'
        const altName = file.name.replace(/\.[^.]+$/, '')
        const result = await imageApi.save(mdFilePath, buffer, ext, altName)
        const op = createInsertImageWithPath(result.relativePath, altName)
        const opResult = op(currentText, currentPos, currentPos)
        applyOperationToTextarea(ta, currentText, opResult.text, opResult.start, opResult.end)
        currentText = opResult.text
        currentPos = opResult.end
      } catch {
        showToast?.(`Failed to save image "${file.name}"`)
      }
    }
  }

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
      if (e.shiftKey && e.code === 'KeyI') {
        e.preventDefault()
        onInsertImageFromPicker?.()
        return
      }
      const match = SHORTCUTS.find(s => s.shift === e.shiftKey && s.code === e.code)
      if (match) {
        e.preventDefault()
        const result = match.op(value, ta.selectionStart, ta.selectionEnd)
        applyOperationToTextarea(ta, value, result.text, result.start, result.end)
        return
      }
    }
  }

  const handleTextChanged = useCallback((newValue: string) => {
    const ta = document.activeElement as HTMLTextAreaElement | null
    if (!ta) { onChange(newValue); return }

    const cursorPos = ta.selectionStart
    if (cursorPos < 1) { onChange(newValue); return }

    const { masked } = maskCodeBlocks(newValue)
    if (masked[cursorPos - 1] === '\x00') {
      onChange(newValue)
      return
    }

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

  return (
    <textarea
      className="w-full h-full bg-transparent text-xs text-white/80 font-mono resize-none outline-none placeholder:text-white/20"
      style={{ userSelect: 'text' }}
      value={value}
      onChange={(e) => handleTextChanged(e.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
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
