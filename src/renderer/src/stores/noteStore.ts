import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { titleToSlug } from '@/utils/slug'
import type { Note } from '@/types/note'
import type { Tab } from '@/types/tab'
import { useSettingsStore } from './settingsStore'
import {
  closeOtherTabs as reduceCloseOtherTabs,
  closeTab as reduceCloseTab,
  closeUnpinnedTabs as reduceCloseUnpinnedTabs,
  deactivateTabs,
  openTab as reduceOpenTab,
  reorderTabs as reduceReorderTabs,
  switchTab as reduceSwitchTab,
  togglePinned,
} from './shared/tab-state'
import {
  appendIndexRecord,
  deleteMarkdownDocument,
  moveMarkdownDocument,
} from './shared/markdown-file-lifecycle'
import { markdownDocumentParts } from './shared/markdown-document-store'


interface NoteStore {
  notes: Note[]
  loaded: boolean
  /** 索引读取/解析失败（非首次启动的 ENOENT）时为 true，UI 据此提示写入已锁定 */
  loadFailed: boolean
  activeNoteId: string | null
  tabs: Tab[]
  activeTabId: string | null
  sortBy: 'time' | 'name'
  viewMode: 'card' | 'compact'
  editorMode: 'live' | 'edit' | 'preview'
  load: () => Promise<void>
  createNote: (title: string, content?: string, tags?: string[]) => Promise<Note>
  deleteNote: (id: string) => Promise<void>
  deleteNotes: (ids: string[]) => Promise<void>
  saveNoteContent: (id: string, content: string) => Promise<void>
  loadNoteContent: (id: string) => Promise<string>
  updateNoteTags: (id: string, tags: string[]) => Promise<void>
  updateNoteTitle: (id: string, title: string) => Promise<void>
  renameTag: (oldName: string, newName: string) => Promise<void>
  deleteTag: (tagName: string) => Promise<void>
  duplicateNote: (id: string) => Promise<Note>
  setActiveNote: (id: string | null) => void
  setSortBy: (sort: 'time' | 'name') => void
  setViewMode: (mode: 'card' | 'compact') => void
  setEditorMode: (mode: 'live' | 'edit' | 'preview') => void
  openTab: (id: string) => void
  closeTab: (id: string) => void
  switchTab: (id: string) => void
  deactivateTab: () => void
  pinTab: (id: string) => void
  reorderTabs: (fromIdx: number, toIdx: number) => void
  closeOtherTabs: (id: string) => void
  closeUnpinnedTabs: () => void
}

const parts = markdownDocumentParts<Note, NoteStore>({
  dirName: 'notes',
  prefsKey: 'notePrefs',
  domainLabel: '笔记',
  names: { list: 'notes', activeId: 'activeNoteId' },
  lifecycle: { appendIndexRecord, deleteMarkdownDocument, moveMarkdownDocument },
  createEntity: (id, title: string, content = '', tags?: string[]) => {
    const now = new Date().toISOString()
    return {
      entity: {
        id,
        title,
        filePath: `notes/${id}-${titleToSlug(title)}.md`,
        color: '#3b82f6',
        tags: tags ?? [],
        createdAt: now,
        updatedAt: now,
      },
      content: content || `# ${title}\n\n`,
    }
  },
  rename: { buildFilePath: (id, slug) => `notes/${id}-${slug}.md` },
})

export const useNoteStore = create<NoteStore>()(
  immer((set, get) => {
    const a = parts.actions(set, get)
    const applyTab = parts.applyTab(set, get)
    return {
      notes: [],
      loaded: false,
      loadFailed: false,
      activeNoteId: null,
      tabs: [],
      activeTabId: null,
      sortBy: 'time',
      viewMode: 'card',
      editorMode: 'edit' as const,

      load: a.load,
      createNote: a.create,
      deleteNote: a.deleteOne,
      deleteNotes: a.deleteMany,
      saveNoteContent: a.saveContent,
      loadNoteContent: a.loadContent,
      updateNoteTags: a.updateTags,
      // config.rename 已提供，updateTitle 必存在
      updateNoteTitle: a.updateTitle!,
      renameTag: a.renameTag,
      deleteTag: a.deleteTag,
      duplicateNote: async (id) => {
        const note = get().notes.find((n) => n.id === id)
        if (!note) throw new Error(`Note ${id} not found`)
        const content = await get().loadNoteContent(id)
        return get().createNote('复制 ' + note.title, content, note.tags ? [...note.tags] : undefined)
      },
      setActiveNote: a.setActive,

      openTab: (id) => {
        const note = get().notes.find((n) => n.id === id)
        if (!note) return
        applyTab((snap) => reduceOpenTab(
          snap,
          { id, title: note.title, pinned: false },
          useSettingsStore.getState().app.maxTabsPerPanel || 20,
        ))
      },
      closeTab: (id) => applyTab((snap) => reduceCloseTab(snap, id)),
      switchTab: (id) => applyTab((snap) => reduceSwitchTab(snap, id)),
      deactivateTab: () => applyTab((snap) => deactivateTabs(snap)),
      pinTab: (id) => applyTab((snap) => togglePinned(snap, id)),
      reorderTabs: (fromIdx, toIdx) => applyTab((snap) => reduceReorderTabs(snap, fromIdx, toIdx)),
      closeOtherTabs: (id) => applyTab((snap) => reduceCloseOtherTabs(snap, id)),
      closeUnpinnedTabs: () => applyTab((snap) => reduceCloseUnpinnedTabs(snap)),

      setSortBy: a.setSortBy,
      setViewMode: a.setViewMode,
      setEditorMode: a.setEditorMode,

    }
  }),
)
