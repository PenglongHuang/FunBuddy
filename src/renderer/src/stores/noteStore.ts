import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { fs, store, imageApi } from '@/lib/ipc'
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
  assertIndexWritable,
  deleteMarkdownDocument,
  moveMarkdownDocument,
} from './shared/markdown-file-lifecycle'


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

export const useNoteStore = create<NoteStore>()(
  immer((set, get) => ({
    notes: [],
    loaded: false,
    loadFailed: false,
    activeNoteId: null,
    tabs: [],
    activeTabId: null,
    sortBy: 'time',
    viewMode: 'card',
    editorMode: 'edit' as const,

    load: async () => {
      let raw: string
      try {
        raw = await fs.readFile('notes/index.json')
      } catch (err) {
        // 首次启动索引不存在：空列表是正常初始态；其余读取失败保持未加载并锁定索引写入
        if (String((err as Error)?.message ?? err).includes('ENOENT')) {
          set({ notes: [], loaded: true, loadFailed: false })
        } else {
          set({ notes: [], loaded: false, loadFailed: true })
        }
        return
      }
      let notes: Note[]
      try {
        notes = JSON.parse(raw.replace(/^\uFEFF/, ''))
      } catch {
        // 索引损坏：不得以空列表覆写，保持未加载
        set({ notes: [], loaded: false, loadFailed: true })
        return
      }
      try {
        const validNotes: Note[] = []
        for (const note of notes) {
          const exists = await fs.exists(note.filePath).catch(() => false)
          if (exists) validNotes.push({ ...note, tags: note.tags ?? [] })
        }
        if (validNotes.length !== notes.length) {
          await fs.writeFile('notes/index.json', JSON.stringify(validNotes, null, 2))
        }
        const prefs = await store.get<{
          sortBy: string
          viewMode: string
          editorMode?: string
          tabs?: { id: string; title: string; pinned: boolean }[]
          activeTabId?: string | null
        }>('notePrefs')
        if (prefs) {
          const validTabs = (prefs.tabs ?? []).filter((t) =>
            validNotes.some((n) => n.id === t.id)
          )
          const refreshedTabs = validTabs.map((t) => {
            const note = validNotes.find((n) => n.id === t.id)
            return { ...t, title: note?.title ?? t.title }
          })
          const validActiveTabId = refreshedTabs.some((t) => t.id === prefs.activeTabId)
            ? prefs.activeTabId ?? null
            : (refreshedTabs[0]?.id ?? null)
          set({
            sortBy: (prefs.sortBy as any) ?? 'time',
            viewMode: (prefs.viewMode as any) ?? 'card',
            editorMode: (prefs.editorMode as 'live' | 'edit' | 'preview') ?? 'edit',
            tabs: refreshedTabs,
            activeTabId: validActiveTabId,
            activeNoteId: validActiveTabId,
          })
        }
        set({ notes: validNotes, loaded: true, loadFailed: false })
      } catch {
        // 解析成功后的修剪重写/偏好读取失败：同样视为未完成加载，锁定写入
        set({ notes: [], loaded: false, loadFailed: true })
      }
    },

    createNote: async (title, content = '', tags) => {
      const id = nanoid(8)
      const slug = titleToSlug(title)
      const filePath = `notes/${id}-${slug}.md`
      const color = '#3b82f6'
      const now = new Date().toISOString()
      const note: Note = { id, title, filePath, color, tags: tags ?? [], createdAt: now, updatedAt: now }

      await fs.writeFile(filePath, content || `# ${title}\n\n`)
      await appendIndexRecord<Note>(fs, 'notes/index.json', note)
      set((s) => { s.notes.push(note) })
      return note
    },

    deleteNote: async (id) => {
      const note = get().notes.find((n) => n.id === id)
      if (note) {
        await deleteMarkdownDocument(fs, imageApi, note.filePath)
      }
      set((s) => { s.notes = s.notes.filter((n) => n.id !== id) })
      assertIndexWritable(get().loaded, '笔记')
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
      get().closeTab(id)
    },

    deleteNotes: async (ids) => {
      const idSet = new Set(ids)
      const notes = get().notes
      for (const note of notes) {
        if (idSet.has(note.id)) {
          await deleteMarkdownDocument(fs, imageApi, note.filePath)
        }
      }
      set((s) => { s.notes = s.notes.filter((n) => !idSet.has(n.id)) })
      assertIndexWritable(get().loaded, '笔记')
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
      for (const id of ids) { get().closeTab(id) }
    },

    saveNoteContent: async (id, content) => {
      const note = get().notes.find((n) => n.id === id)
      if (!note) return
      await fs.writeFile(note.filePath, content)
    },

    loadNoteContent: async (id) => {
      const note = get().notes.find((n) => n.id === id)
      if (!note) return ''
      return fs.readFile(note.filePath)
    },

    updateNoteTags: async (id, tags) => {
      set((s) => {
        const note = s.notes.find((n) => n.id === id)
        if (!note) return
        note.tags = tags
        note.updatedAt = new Date().toISOString()
      })
      assertIndexWritable(get().loaded, '笔记')
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
    },

    updateNoteTitle: async (id, title) => {
      const note = get().notes.find((n) => n.id === id)
      if (!note) return

      const slug = titleToSlug(title)
      const newFilePath = `notes/${id}-${slug}.md`

      if (newFilePath !== note.filePath) {
        await moveMarkdownDocument(fs, imageApi, note.filePath, newFilePath)
      }

      set((s) => {
        const n = s.notes.find((n) => n.id === id)
        if (!n) return
        n.title = title
        n.filePath = newFilePath
        n.updatedAt = new Date().toISOString()
        const tab = s.tabs.find((t) => t.id === id)
        if (tab) tab.title = title
      })
      assertIndexWritable(get().loaded, '笔记')
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
    },

    renameTag: async (oldName, newName) => {
      const trimmed = newName.trim()
      if (!trimmed) return
      set((s) => {
        for (const note of s.notes) {
          if (note.tags) {
            note.tags = note.tags.map((t) => (t === oldName ? trimmed : t))
            note.updatedAt = new Date().toISOString()
          }
        }
      })
      assertIndexWritable(get().loaded, '笔记')
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
    },

    deleteTag: async (tagName) => {
      set((s) => {
        for (const note of s.notes) {
          if (note.tags) {
            note.tags = note.tags.filter((t) => t !== tagName)
            note.updatedAt = new Date().toISOString()
          }
        }
      })
      assertIndexWritable(get().loaded, '笔记')
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
    },

    duplicateNote: async (id) => {
      const note = get().notes.find((n) => n.id === id)
      if (!note) throw new Error(`Note ${id} not found`)
      const content = await get().loadNoteContent(id)
      return get().createNote('复制 ' + note.title, content, note.tags ? [...note.tags] : undefined)
    },

    setActiveNote: (id) => set({ activeNoteId: id }),

    openTab: (id) => {
      const note = get().notes.find((n) => n.id === id)
      if (!note) return
      const result = reduceOpenTab(
        { tabs: get().tabs, activeTabId: get().activeTabId },
        { id, title: note.title, pinned: false },
        useSettingsStore.getState().app.maxTabsPerPanel || 20,
      )
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activeNoteId: result.activeTabId })
      persistNotePrefs(get)
    },

    closeTab: (id) => {
      const current = { tabs: get().tabs, activeTabId: get().activeTabId }
      const result = reduceCloseTab(current, id)
      if (result === current) return
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activeNoteId: result.activeTabId })
      persistNotePrefs(get)
    },

    switchTab: (id) => {
      const current = { tabs: get().tabs, activeTabId: get().activeTabId }
      const result = reduceSwitchTab(current, id)
      if (result === current) return
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activeNoteId: result.activeTabId })
      persistNotePrefs(get)
    },

    deactivateTab: () => {
      const result = deactivateTabs({ tabs: get().tabs, activeTabId: get().activeTabId })
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activeNoteId: result.activeTabId })
      persistNotePrefs(get)
    },

    pinTab: (id) => {
      const result = togglePinned({ tabs: get().tabs, activeTabId: get().activeTabId }, id)
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activeNoteId: result.activeTabId })
      persistNotePrefs(get)
    },

    reorderTabs: (fromIdx, toIdx) => {
      const result = reduceReorderTabs(
        { tabs: get().tabs, activeTabId: get().activeTabId },
        fromIdx,
        toIdx,
      )
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activeNoteId: result.activeTabId })
      persistNotePrefs(get)
    },

    closeOtherTabs: (id) => {
      const current = { tabs: get().tabs, activeTabId: get().activeTabId }
      const result = reduceCloseOtherTabs(current, id)
      if (result === current) return
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activeNoteId: result.activeTabId })
      persistNotePrefs(get)
    },

    closeUnpinnedTabs: () => {
      const result = reduceCloseUnpinnedTabs({ tabs: get().tabs, activeTabId: get().activeTabId })
      set({ tabs: result.tabs, activeTabId: result.activeTabId, activeNoteId: result.activeTabId })
      persistNotePrefs(get)
    },

    setSortBy: (sort) => {
      set({ sortBy: sort })
      persistNotePrefs(get)
    },

    setViewMode: (mode) => {
      set({ viewMode: mode })
      persistNotePrefs(get)
    },

    setEditorMode: (mode) => {
      set({ editorMode: mode })
      persistNotePrefs(get)
    },

  }))
)

function persistNotePrefs(get: () => NoteStore) {
  store.set('notePrefs', {
    sortBy: get().sortBy,
    viewMode: get().viewMode,
    editorMode: get().editorMode,
    tabs: get().tabs,
    activeTabId: get().activeTabId,
  })
}
