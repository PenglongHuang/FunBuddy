import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourcePath = fileURLToPath(new URL('./PlanEditor.tsx', import.meta.url))

describe('PlanEditor architecture', () => {
  it('delegates plan editing to MarkdownDocumentEditor', () => {
    const source = readFileSync(sourcePath, 'utf8')
    const forbiddenNames = [
      'MarkdownEditor',
      'MarkdownPreview',
      'SplitPaneLiveEditor',
      'MarkdownContextMenu',
      'LinkSuggestionPopup',
      'TableOfContents',
      'imageApi',
      'pdfExport',
      'useDocumentPersistence',
    ]

    expect(source).toContain('MarkdownDocumentEditor')
    for (const name of forbiddenNames) {
      expect(source).not.toContain(name)
    }
    expect(source.split('\n').length).toBeLessThan(100)
  })
})
