import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Download, Eye, List, MoreVertical, Pencil, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import ContextMenu from '@/components/ui/ContextMenu'
import MarkdownContextMenu from '@/components/ui/MarkdownContextMenu'
import ExportDialog from '@/components/common/ExportDialog'
import LinkSuggestionPopup from '@/components/common/LinkSuggestionPopup'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import MarkdownPreview from '@/components/common/MarkdownPreview'
import SplitPaneLiveEditor from '@/components/common/SplitPaneLiveEditor'
import TableOfContents from '@/components/common/TableOfContents'
import TagInput from '@/components/common/TagInput'
import { useToast } from '@/components/common/Toast'
import useTextSelection from '@/hooks/useTextSelection'
import { buildExportHtml, type ExportMode } from '@/lib/export-pdf'
import { imageApi, pdfExport } from '@/lib/ipc'
import type { LinkSearchResult } from '@/lib/link-resolver'
import {
  applyOperationToTextarea,
  createInsertImageWithPath,
  createInsertLinkRef,
} from '@/lib/markdown-operations'
import { extractHeadings } from '@/lib/toc-extract'
import { useToastStore } from '@/stores/toastStore'
import { hasLinkTrigger, lineIndexToOffset } from './editor-utils'
import type { MarkdownDocumentEditorProps } from './types'
import { useDocumentPersistence } from './useDocumentPersistence'

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const { overflowY } = getComputedStyle(parent)
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

function scrollToElement(element: HTMLElement) {
  const container = findScrollParent(element)
  if (!container) return
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  container.scrollTo({
    top: container.scrollTop + elementRect.top - containerRect.top,
    behavior: 'smooth',
  })
}

export default function MarkdownDocumentEditor({
  document,
  allTags,
  mode,
  onModeChange,
  tocMaxLevel,
  placeholder,
  loadContent,
  saveContent,
  updateTitle,
  updateTags,
  exportMeta,
  onBack,
  onLinkClick,
}: MarkdownDocumentEditorProps) {
  const [tocVisible, setTocVisible] = useState(false)
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(0)
  const [contextMenuState, setContextMenuState] = useState<{
    anchorRect: DOMRect
    mode: 'edit' | 'live' | 'preview'
    selection: { start: number; end: number } | null
  } | null>(null)
  const [textareaEl, setTextareaEl] = useState<HTMLTextAreaElement | null>(null)
  const [linkPopupState, setLinkPopupState] = useState<{
    anchorRect: { x: number; y: number }
    triggerStart: number
  } | null>(null)
  const [editorContextMenu, setEditorContextMenu] = useState<DOMRect | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const toggleTocRef = useRef<() => void>(() => undefined)
  const editorRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const { showToast, ToastContainer } = useToast()

  const { content, contentRef, dirty, handleChange } = useDocumentPersistence({
    documentId: document.id,
    documentTitle: document.title,
    loadContent,
    saveContent,
    updateTitle,
    showToast,
  })

  useTextSelection(textareaEl)

  const toggleToc = useCallback(() => setTocVisible((visible) => !visible), [])
  toggleTocRef.current = toggleToc

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'O') {
        event.preventDefault()
        toggleTocRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!editorRef.current) return
    setTextareaEl(editorRef.current.querySelector('textarea'))
  }, [document.id, mode])

  const handleTriggerLinkPopup = useCallback((triggerStart: number) => {
    if (!textareaEl) return
    const rect = textareaEl.getBoundingClientRect()
    const lineCount = content.substring(0, triggerStart).split('\n').length - 1
    setLinkPopupState({
      anchorRect: { x: rect.left + 10, y: rect.top + Math.min(lineCount * 18, rect.height - 50) },
      triggerStart,
    })
  }, [content, textareaEl])

  const handleLinkSelect = useCallback((result: LinkSearchResult) => {
    if (!linkPopupState || !textareaEl) return
    const { triggerStart } = linkPopupState
    const cursorPosition = textareaEl.selectionStart
    const cleanedText = content.substring(0, triggerStart) + content.substring(cursorPosition)
    const operation = createInsertLinkRef(result.id, result.title)
    const operationResult = operation(cleanedText, triggerStart, triggerStart)
    applyOperationToTextarea(
      textareaEl,
      content,
      operationResult.text,
      operationResult.start,
      operationResult.end,
    )
    setLinkPopupState(null)
  }, [content, linkPopupState, textareaEl])

  const handleLinkPopupClose = useCallback(() => {
    if (!linkPopupState || !textareaEl) {
      setLinkPopupState(null)
      return
    }
    const { triggerStart } = linkPopupState
    const cursorPosition = textareaEl.selectionStart
    const triggerLength = cursorPosition - triggerStart
    if (triggerLength > 0 && triggerLength <= 2) {
      const cleanedText = content.substring(0, triggerStart) + content.substring(cursorPosition)
      applyOperationToTextarea(textareaEl, content, cleanedText, triggerStart, triggerStart)
    }
    setLinkPopupState(null)
  }, [content, linkPopupState, textareaEl])

  const handleGuardedLinkClick = useCallback((id: string, type: string) => {
    if (type === 'deleted') {
      showToast('链接指向的内容已被删除')
      return
    }
    onLinkClick(id, type)
  }, [onLinkClick, showToast])

  useEffect(() => {
    if (linkPopupState && !hasLinkTrigger(content, linkPopupState.triggerStart)) {
      setLinkPopupState(null)
    }
  }, [content, linkPopupState])

  const handleEditorContextMenu = useCallback((event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault()
    const textarea = event.currentTarget
    setContextMenuState({
      anchorRect: DOMRect.fromRect({ width: 0, height: 0, x: event.clientX, y: event.clientY }),
      mode,
      selection: { start: textarea.selectionStart, end: textarea.selectionEnd },
    })
  }, [mode])

  const handlePreviewContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenuState({
      anchorRect: DOMRect.fromRect({ width: 0, height: 0, x: event.clientX, y: event.clientY }),
      mode: 'preview',
      selection: null,
    })
  }, [])

  const handleApplyOperation = useCallback((newText: string, cursorStart: number, cursorEnd: number) => {
    if (!textareaEl) return
    applyOperationToTextarea(textareaEl, content, newText, cursorStart, cursorEnd)
    setContextMenuState(null)
  }, [content, textareaEl])

  const handleInsertImageFromPicker = useCallback(async () => {
    if (!textareaEl) return
    try {
      const result = await imageApi.pickAndSave(document.filePath)
      if (!result) return
      const operation = createInsertImageWithPath(result.relativePath, result.fileName)
      const operationResult = operation(content, textareaEl.selectionStart, textareaEl.selectionEnd)
      applyOperationToTextarea(
        textareaEl,
        content,
        operationResult.text,
        operationResult.start,
        operationResult.end,
      )
    } catch {
      showToast('保存图片失败')
    }
  }, [content, document.filePath, showToast, textareaEl])

  const handleHeadingClick = useCallback((lineIndex: number) => {
    setCurrentLineIndex(lineIndex)
    if (!editorRef.current) return

    if (mode === 'edit' || mode === 'live') {
      const textarea = editorRef.current.querySelector('textarea')
      if (!textarea) return
      const position = lineIndexToOffset(content, lineIndex)
      textarea.focus()
      textarea.setSelectionRange(position, position)
      const style = getComputedStyle(textarea)
      const measure = window.document.createElement('div')
      measure.style.cssText = [
        'position:absolute', 'visibility:hidden', 'white-space:pre-wrap', 'word-wrap:break-word',
        `width:${style.width}`, `font:${style.font}`, `padding:${style.padding}`,
        `border:${style.border}`, `line-height:${style.lineHeight}`,
        `letter-spacing:${style.letterSpacing}`,
      ].join(';')
      measure.textContent = content.substring(0, position)
      window.document.body.appendChild(measure)
      textarea.scrollTop = measure.offsetHeight - parseInt(style.paddingTop || '0')
      window.document.body.removeChild(measure)
      return
    }

    const headings = extractHeadings(content, tocMaxLevel)
    const targetIndex = headings.findIndex((heading) => heading.lineIndex === lineIndex)
    const headingElements = editorRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')
    if (targetIndex !== -1 && headingElements.length > targetIndex) {
      scrollToElement(headingElements[targetIndex] as HTMLElement)
    }
  }, [content, mode, tocMaxLevel])

  const handleExport = async (exportMode: ExportMode) => {
    try {
      // 未保存的修改必须进 PDF；磁盘内容可能落后于编辑器
      const currentContent = contentRef.current
      const html = await buildExportHtml({
        content: currentContent,
        mdFilePath: document.filePath,
        title: document.title,
        mode: exportMode,
        fileName: `${document.title}.pdf`,
        meta: exportMeta,
      })
      const result = await pdfExport.generate(html, `${document.title}.pdf`)
      setExportOpen(false)
      if (result.success && 'filePath' in result) {
        useToastStore.getState().show('PDF 导出成功')
      } else if (!result.success) {
        useToastStore.getState().show('导出失败: ' + result.error)
      }
    } catch (error: unknown) {
      setExportOpen(false)
      const message = error instanceof Error ? error.message : String(error)
      useToastStore.getState().show('导出失败: ' + message)
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col h-full gap-3" style={{ position: 'relative', paddingTop: 8 }}>
      <ToastContainer />

      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => {
            if (tocVisible) setTocVisible(false)
            onBack()
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          style={{
            width: 30, height: 30, borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-tertiary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <ArrowLeft size={15} />
        </motion.button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: document.color, flexShrink: 0 }} />
          <span className="truncate" style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600 }}>
            {document.title}
          </span>
          {dirty && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-orange)', flexShrink: 0 }} />
          )}
        </div>

        <motion.button
          onClick={toggleToc}
          whileTap={{ scale: 0.9 }}
          title="目录 (Ctrl+Shift+O)"
          style={{
            width: 24, height: 24, borderRadius: 5,
            background: tocVisible ? 'rgba(10,132,255,0.15)' : 'transparent',
            border: tocVisible ? '0.5px solid rgba(10,132,255,0.30)' : 'none',
            color: tocVisible ? 'var(--accent-blue)' : 'var(--text-quaternary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s ease, color 0.2s ease',
          }}
        >
          <List size={12} />
        </motion.button>

        <div className="flex gap-0.5" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          {([['edit', Pencil], ['live', Zap], ['preview', Eye]] as const).map(([nextMode, Icon]) => (
            <motion.button
              key={nextMode}
              onClick={() => onModeChange(nextMode)}
              whileTap={{ scale: 0.9 }}
              style={{
                width: 28, height: 24, borderRadius: 5,
                background: mode === nextMode ? 'var(--accent-blue)' : 'transparent',
                color: mode === nextMode ? '#fff' : 'var(--text-quaternary)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'background 0.2s ease, color 0.2s ease',
              }}
            >
              <Icon size={12} />
            </motion.button>
          ))}
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation()
            setEditorContextMenu(event.currentTarget.getBoundingClientRect())
          }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-quaternary)', padding: 4, borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
        >
          <MoreVertical size={14} />
        </button>
      </div>

      <TagInput
        tags={document.tags}
        allTags={allTags}
        onUpdateTags={updateTags}
        placeholder="添加标签..."
      />

      <div ref={editorRef} className="flex-1 min-h-0" style={{ overflow: mode === 'preview' ? 'auto' : 'hidden' }}>
        {mode === 'live' ? (
          <SplitPaneLiveEditor
            key={document.id}
            value={content}
            onChange={handleChange}
            onCursorLineChange={setCurrentLineIndex}
            onContextMenu={handleEditorContextMenu}
            onPreviewContextMenu={handlePreviewContextMenu}
            mdFilePath={document.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
            onTriggerLinkPopup={handleTriggerLinkPopup}
            onLinkClick={handleGuardedLinkClick}
            placeholder={placeholder}
          />
        ) : mode === 'edit' ? (
          <MarkdownEditor
            value={content}
            onChange={handleChange}
            onCursorLineChange={setCurrentLineIndex}
            placeholder={placeholder}
            onContextMenu={handleEditorContextMenu}
            mdFilePath={document.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
            onTriggerLinkPopup={handleTriggerLinkPopup}
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-auto" style={{ userSelect: 'text' }} onContextMenu={handlePreviewContextMenu}>
            <MarkdownPreview content={content} mdFilePath={document.filePath} onLinkClick={handleGuardedLinkClick} />
          </div>
        )}
      </div>

      {rootRef.current && createPortal(
        <TableOfContents
          content={content}
          maxLevel={tocMaxLevel}
          currentLineIndex={currentLineIndex}
          onHeadingClick={handleHeadingClick}
          onClose={() => setTocVisible(false)}
          open={tocVisible}
        />,
        rootRef.current,
      )}

      {contextMenuState && createPortal(
        <MarkdownContextMenu
          anchorRect={contextMenuState.anchorRect}
          onClose={() => setContextMenuState(null)}
          mode={contextMenuState.mode}
          text={content}
          selectionStart={contextMenuState.selection?.start ?? 0}
          selectionEnd={contextMenuState.selection?.end ?? 0}
          selectedText={contextMenuState.selection
            ? content.substring(contextMenuState.selection.start, contextMenuState.selection.end)
            : ''}
          hasSelection={contextMenuState.selection
            ? contextMenuState.selection.start !== contextMenuState.selection.end
            : false}
          onApplyOperation={handleApplyOperation}
          previewContent={content}
          onInsertImage={handleInsertImageFromPicker}
          onInsertLinkRef={() => handleTriggerLinkPopup(textareaEl?.selectionStart ?? 0)}
        />,
        window.document.body,
      )}

      {linkPopupState && createPortal(
        <LinkSuggestionPopup
          anchorRect={linkPopupState.anchorRect}
          onSelect={handleLinkSelect}
          onClose={handleLinkPopupClose}
        />,
        window.document.body,
      )}

      {editorContextMenu && (
        <ContextMenu
          items={[{
            label: '导出 PDF',
            icon: <Download size={13} />,
            onClick: () => {
              setExportOpen(true)
              setEditorContextMenu(null)
            },
          }]}
          anchorRect={editorContextMenu}
          onClose={() => setEditorContextMenu(null)}
        />
      )}
      {exportOpen && <ExportDialog open onClose={() => setExportOpen(false)} onExport={handleExport} />}
    </div>
  )
}
