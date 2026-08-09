import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import MarkdownDocumentEditor from './MarkdownDocumentEditor'
import type { EditorMode, MarkdownDocumentEditorProps } from './types'

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
