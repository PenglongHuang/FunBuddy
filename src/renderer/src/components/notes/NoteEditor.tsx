import { useCallback, useMemo } from 'react'
import { MarkdownDocumentEditor } from '@/components/common/document-editor'
import { getAllTags } from '@/lib/tag-utils'
import { useNavigationStore } from '@/stores/navigationStore'
import { useNoteStore } from '@/stores/noteStore'
import { useSettingsStore } from '@/stores/settingsStore'

export default function NoteEditor() {
  const activeNoteId = useNoteStore((state) => state.activeNoteId)
  const note = useNoteStore((state) => state.notes.find((item) => item.id === activeNoteId))
  const notes = useNoteStore((state) => state.notes)
  const mode = useNoteStore((state) => state.editorMode)
  const tocMaxLevel = useSettingsStore((state) => state.app.tocMaxLevel)
  const navPush = useNavigationStore((state) => state.push)
  const allTags = useMemo(() => getAllTags(notes), [notes])

  const loadContent = useCallback(
    () => activeNoteId ? useNoteStore.getState().loadNoteContent(activeNoteId) : Promise.resolve(''),
    [activeNoteId],
  )
  const saveContent = useCallback(
    (content: string) => activeNoteId ? useNoteStore.getState().saveNoteContent(activeNoteId, content) : Promise.resolve(),
    [activeNoteId],
  )
  const updateTitle = useCallback(
    (title: string) => activeNoteId ? useNoteStore.getState().updateNoteTitle(activeNoteId, title) : Promise.resolve(),
    [activeNoteId],
  )
  const updateTags = useCallback(
    (tags: string[]) => activeNoteId ? useNoteStore.getState().updateNoteTags(activeNoteId, tags) : Promise.resolve(),
    [activeNoteId],
  )

  if (!note) return null

  return (
    <MarkdownDocumentEditor
      key={note.id}
      document={{ ...note, tags: note.tags ?? [] }}
      allTags={allTags}
      mode={mode}
      onModeChange={(nextMode) => useNoteStore.getState().setEditorMode(nextMode)}
      tocMaxLevel={tocMaxLevel}
      placeholder={'# 标题\n\n内容...'}
      loadContent={loadContent}
      saveContent={saveContent}
      updateTitle={updateTitle}
      updateTags={updateTags}
      exportMeta={{ tags: note.tags, createdAt: note.createdAt?.slice(0, 10) }}
      onBack={() => {
        useNoteStore.getState().deactivateTab()
        navPush({ panel: 'notes', subView: 'list' })
      }}
      onLinkClick={(id, type) => {
        if (type === 'note') navPush({ panel: 'notes', subView: 'editor', noteId: id })
        if (type === 'plan') navPush({ panel: 'planner', subView: 'editor', planId: id })
      }}
    />
  )
}
