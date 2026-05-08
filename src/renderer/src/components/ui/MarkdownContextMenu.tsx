import { useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import ContextMenu from './ContextMenu'
import {
  copyToClipboard, pasteFromClipboard,
  wrapBold, wrapItalic, wrapStrikethrough, wrapHighlight,
  toggleHeading, toggleBlockquote, toggleUnorderedList, toggleOrderedList, toggleTaskList,
  insertLink, insertTable, insertHorizontalRule, insertImage, insertCodeBlock,
} from '@/lib/markdown-operations'
import { Bold, Italic, Strikethrough, Highlighter, Type, Quote, List, ListOrdered, CheckSquare, Link as LinkIcon, Table, Minus, Image, Code, Copy, Clipboard, Scissors } from 'lucide-react'

interface MarkdownContextMenuProps {
  anchorRect: DOMRect
  onClose: () => void
  mode: 'edit' | 'live' | 'preview'
  text: string
  selectionStart: number
  selectionEnd: number
  selectedText: string
  hasSelection: boolean
  onApplyOperation: (newText: string, newStart: number, newEnd: number) => void
  previewContent?: string
}

export default function MarkdownContextMenu({
  anchorRect, onClose, mode, text, selectionStart, selectionEnd,
  selectedText, hasSelection, onApplyOperation, previewContent,
}: MarkdownContextMenuProps) {

  const applyOp = useCallback((op: typeof wrapBold) => {
    const result = op(text, selectionStart, selectionEnd)
    onApplyOperation(result.text, result.start, result.end)
  }, [text, selectionStart, selectionEnd, onApplyOperation])

  // --- basic edit operations ---
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
    } catch { /* clipboard unavailable */ }
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

  // --- edit mode menu ---
  const editItems = useMemo(() => {
    const noop = () => {}
    const items: Array<{
      label: string
      icon?: React.ReactNode
      onClick: () => void
      submenu?: Array<{ label: string; icon?: React.ReactNode; shortcut?: string; disabled?: boolean; onClick: () => void }>
      disabled?: boolean
      shortcut?: string
      isGroupHeader?: boolean
    }> = []

    items.push({ label: '基础编辑', onClick: noop, isGroupHeader: true })
    items.push({ label: '复制', icon: <Copy size={13} />, shortcut: '⌘C', disabled: !hasSelection, onClick: applyCopy })
    items.push({ label: '粘贴', icon: <Clipboard size={13} />, shortcut: '⌘V', onClick: applyPaste })
    items.push({ label: '剪切', icon: <Scissors size={13} />, shortcut: '⌘X', disabled: !hasSelection, onClick: applyCut })

    items.push({ label: '文本格式', onClick: noop, isGroupHeader: true })
    items.push({
      label: '文本格式', icon: <Type size={13} />, onClick: noop,
      submenu: [
        { label: '加粗', icon: <Bold size={13} />, shortcut: '⌘B', disabled: !hasSelection, onClick: () => applyOp(wrapBold) },
        { label: '斜体', icon: <Italic size={13} />, shortcut: '⌘I', disabled: !hasSelection, onClick: () => applyOp(wrapItalic) },
        { label: '删除线', icon: <Strikethrough size={13} />, shortcut: '⌘⇧S', disabled: !hasSelection, onClick: () => applyOp(wrapStrikethrough) },
        { label: '高亮', icon: <Highlighter size={13} />, shortcut: '⌘⇧H', disabled: !hasSelection, onClick: () => applyOp(wrapHighlight) },
      ],
    })

    items.push({ label: '段落样式', onClick: noop, isGroupHeader: true })
    items.push({
      label: '段落样式', onClick: noop,
      submenu: [
        { label: '标题 1', shortcut: '⌘⇧1', onClick: () => applyOp(toggleHeading(1)) },
        { label: '标题 2', shortcut: '⌘⇧2', onClick: () => applyOp(toggleHeading(2)) },
        { label: '标题 3', shortcut: '⌘⇧3', onClick: () => applyOp(toggleHeading(3)) },
        { label: '标题 4', onClick: () => applyOp(toggleHeading(4)) },
        { label: '标题 5', onClick: () => applyOp(toggleHeading(5)) },
        { label: '标题 6', onClick: () => applyOp(toggleHeading(6)) },
        { label: '引用块', icon: <Quote size={13} />, shortcut: '⌘⇧Q', onClick: () => applyOp(toggleBlockquote) },
        { label: '无序列表', icon: <List size={13} />, shortcut: '⌘⇧U', onClick: () => applyOp(toggleUnorderedList) },
        { label: '有序列表', icon: <ListOrdered size={13} />, shortcut: '⌘⇧L', onClick: () => applyOp(toggleOrderedList) },
        { label: '任务列表', icon: <CheckSquare size={13} />, shortcut: '⌘⇧T', onClick: () => applyOp(toggleTaskList) },
      ],
    })

    items.push({ label: '插入元素', onClick: noop, isGroupHeader: true })
    items.push({
      label: '插入元素', icon: <LinkIcon size={13} />, onClick: noop,
      submenu: [
        { label: '超链接', icon: <LinkIcon size={13} />, shortcut: '⌘K', onClick: () => applyOp(insertLink) },
        { label: '表格', icon: <Table size={13} />, onClick: () => applyOp(insertTable) },
        { label: '分割线', icon: <Minus size={13} />, onClick: () => applyOp(insertHorizontalRule) },
        { label: '图片', icon: <Image size={13} />, onClick: () => applyOp(insertImage) },
        { label: '代码块', icon: <Code size={13} />, shortcut: '⌘⇧C', onClick: () => applyOp(insertCodeBlock) },
      ],
    })

    return items
  }, [hasSelection, applyOp, applyCopy, applyPaste, applyCut])

  // --- preview mode menu ---
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

  const items = mode === 'preview' ? previewItems : editItems

  return createPortal(
    <ContextMenu items={items as any} anchorRect={anchorRect} onClose={onClose} />,
    document.body
  )
}
