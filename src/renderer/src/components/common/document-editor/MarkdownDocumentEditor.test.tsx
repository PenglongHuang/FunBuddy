// @vitest-environment jsdom
import * as React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExportHtml } from '@/lib/export-pdf'
import { pdfExport } from '@/lib/ipc'
import MarkdownDocumentEditor from './MarkdownDocumentEditor'
import type { EditorMode, MarkdownDocumentEditorProps } from './types'

// #7 回归:导出必须用编辑器当前内容(contentRef),磁盘内容可能落后于编辑器。
// 只 mock 出口边界(buildExportHtml / pdfExport),编辑→handleChange→contentRef→handleExport 全走真实代码。
vi.mock('@/lib/export-pdf', () => ({
  buildExportHtml: vi.fn(async () => '<html>exported</html>'),
}))

vi.mock('@/lib/ipc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ipc')>()
  return {
    ...actual,
    pdfExport: { generate: vi.fn(async () => ({ success: true, filePath: 'C:/out/test.pdf' })) },
  }
})

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function createProps(mode: EditorMode): MarkdownDocumentEditorProps {
  return {
    document: {
      id: 'document-1',
      title: 'Test document',
      filePath: 'C:/documents/test.md',
      color: '#0a84ff',
      tags: ['test'],
    },
    allTags: ['test', 'shared'],
    mode,
    onModeChange: vi.fn(),
    tocMaxLevel: 3,
    placeholder: 'Write something',
    loadContent: vi.fn(async () => '# Test document'),
    saveContent: vi.fn(async () => undefined),
    updateTitle: vi.fn(async () => undefined),
    updateTags: vi.fn(async () => undefined),
    exportMeta: { tags: ['test'] },
    onBack: vi.fn(),
    onLinkClick: vi.fn(),
  }
}

describe('MarkdownDocumentEditor modes', () => {
  it('renders a textarea in edit mode', () => {
    const markup = renderToStaticMarkup(<MarkdownDocumentEditor {...createProps('edit')} />)

    expect(markup).toContain('<textarea')
  })

  it('renders a textarea and preview pane in live mode', () => {
    const markup = renderToStaticMarkup(<MarkdownDocumentEditor {...createProps('live')} />)

    expect(markup).toContain('<textarea')
    expect(markup).toContain('live-preview-pane')
  })

  it('renders markdown without a textarea in preview mode', () => {
    const markup = renderToStaticMarkup(<MarkdownDocumentEditor {...createProps('preview')} />)

    expect(markup).not.toContain('<textarea')
    expect(markup).toContain('markdown-body')
  })
})

function clickButton(button: HTMLElement): Promise<void> {
  return act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

describe('MarkdownDocumentEditor export uses current editor content (#7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports the edited unsaved content, not the stale on-disk content', async () => {
    const props = createProps('edit')
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(<MarkdownDocumentEditor {...props} />)
      })
      // flush loadContent 的异步加载
      await act(async () => {})

      // 1) 编辑:真实 textarea input → MarkdownEditor onChange → useDocumentPersistence.handleChange → contentRef
      const textarea = container.querySelector('textarea')
      expect(textarea).not.toBeNull()
      expect(textarea!.value).toBe('# Test document')
      const edited = '# Test document\n\n编辑后的新段落'
      await act(async () => {
        const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
        setValue.call(textarea!, edited)
        textarea!.dispatchEvent(new Event('input', { bubbles: true }))
      })
      expect(textarea!.value).toBe(edited)

      // 2) 导出:右上菜单(⋯)→ ContextMenu「导出 PDF」→ ExportDialog「导出」
      const moreButton = container
        .querySelector('button svg.lucide-ellipsis-vertical')
        ?.closest('button')
      expect(moreButton).toBeDefined()
      await clickButton(moreButton!)

      const exportMenuItem = [...container.querySelectorAll('button')]
        .find((b) => b.textContent === '导出 PDF')
      expect(exportMenuItem).toBeDefined()
      await clickButton(exportMenuItem!)

      const exportButton = [...container.querySelectorAll('button')]
        .find((b) => b.textContent === '导出')
      expect(exportButton).toBeDefined()
      await clickButton(exportButton!)

      // flush handleExport 的 await 链
      await act(async () => {})

      // 3) buildExportHtml 收到编辑后的内容(而非 loadContent 的磁盘旧内容)
      expect(vi.mocked(buildExportHtml)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(buildExportHtml).mock.calls[0][0]).toMatchObject({ content: edited })
      expect(vi.mocked(pdfExport.generate)).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    }
  })
})
