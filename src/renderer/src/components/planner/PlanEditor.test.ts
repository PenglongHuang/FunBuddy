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
    expect(source).toContain("placeholder={'# 计划内容\\n\\n- [ ] 待办项 1\\n- [ ] 待办项 2'}")
    for (const name of forbiddenNames) {
      expect(source).not.toContain(name)
    }
    expect(source.split('\n').length).toBeLessThan(100)
  })
})
