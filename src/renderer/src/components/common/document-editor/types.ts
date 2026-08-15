import type { ExportOptions } from '@/lib/export-pdf'

export type EditorMode = 'live' | 'edit' | 'preview'

export interface MarkdownDocumentDescriptor {
  id: string
  title: string
  filePath: string
  color: string
  tags: string[]
}

export interface MarkdownDocumentEditorProps {
  document: MarkdownDocumentDescriptor
  allTags: string[]
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
  tocMaxLevel: number
  placeholder: string
  loadContent: () => Promise<string>
  saveContent: (content: string) => Promise<void>
  updateTitle: (title: string) => Promise<void>
  updateTags: (tags: string[]) => Promise<void>
  exportMeta: ExportOptions['meta']
  onBack: () => void
  onLinkClick: (id: string, type: string) => void
}
