import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { fs, store, imageApi } from '@/lib/ipc'
import { titleToSlug } from '@/utils/slug'
import type { Note } from '@/types/note'
import type { Tab } from '@/types/tab'
import { useSettingsStore } from './settingsStore'


interface NoteStore {
  notes: Note[]
  loaded: boolean
  activeNoteId: string | null
  tabs: Tab[]
  activeTabId: string | null
  sortBy: 'time' | 'name'
  viewMode: 'card' | 'compact'
  editorMode: 'live' | 'edit' | 'preview'
  tocMaxLevel: number
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
  setTocMaxLevel: (level: number) => void
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
    activeNoteId: null,
    tabs: [],
    activeTabId: null,
    sortBy: 'time',
    viewMode: 'card',
    editorMode: 'edit' as const,
    tocMaxLevel: 3,

    load: async () => {
      try {
        const raw = await fs.readFile('notes/index.json')
        const notes: Note[] = JSON.parse(raw)
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
          tocMaxLevel?: number
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
            tocMaxLevel: prefs.tocMaxLevel ?? 3,
            tabs: refreshedTabs,
            activeTabId: validActiveTabId,
            activeNoteId: validActiveTabId,
          })
        }
        set({ notes: validNotes, loaded: true })
      } catch {
        set({ notes: [], loaded: true })
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

      // Read-modify-write to avoid overwriting notes from other windows
      let diskNotes: Note[] = []
      try {
        diskNotes = JSON.parse(await fs.readFile('notes/index.json'))
      } catch { /* empty or missing */ }
      diskNotes.push(note)
      await fs.writeFile('notes/index.json', JSON.stringify(diskNotes, null, 2))

      set((s) => { s.notes.push(note) })
      return note
    },

    deleteNote: async (id) => {
      const note = get().notes.find((n) => n.id === id)
      if (note) {
        try { await imageApi.cleanup(note.filePath) } catch {}
        try { await fs.deleteFile(note.filePath) } catch {}
      }
      set((s) => { s.notes = s.notes.filter((n) => n.id !== id) })
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
      get().closeTab(id)
    },

    deleteNotes: async (ids) => {
      const idSet = new Set(ids)
      const notes = get().notes
      for (const note of notes) {
        if (idSet.has(note.id)) {
          try { await imageApi.cleanup(note.filePath) } catch {}
          try { await fs.deleteFile(note.filePath) } catch { /* already deleted */ }
        }
      }
      set((s) => { s.notes = s.notes.filter((n) => !idSet.has(n.id)) })
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
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
    },

    updateNoteTitle: async (id, title) => {
      const note = get().notes.find((n) => n.id === id)
      if (!note) return

      const slug = titleToSlug(title)
      const newFilePath = `notes/${id}-${slug}.md`

      if (newFilePath !== note.filePath) {
        const content = await fs.readFile(note.filePath)
        await fs.writeFile(newFilePath, content)
        try { await fs.deleteFile(note.filePath) } catch {}
        try { await imageApi.moveAssets(note.filePath, newFilePath) } catch {}
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
      const { tabs, notes } = get()
      const note = notes.find((n) => n.id === id)
      if (!note) return
      const existing = tabs.find((t) => t.id === id)
      if (existing) {
        set({ activeTabId: id, activeNoteId: id })
      } else {
        const newTab: Tab = { id, title: note.title, pinned: false }
        set((s) => {
          const maxTabs = useSettingsStore.getState().app.maxTabsPerPanel || 20
          if (s.tabs.length >= maxTabs) {
            let lastUnpinnedIdx = -1
            for (let i = s.tabs.length - 1; i >= 0; i--) {
              if (!s.tabs[i].pinned) { lastUnpinnedIdx = i; break }
            }
            if (lastUnpinnedIdx !== -1) {
              s.tabs.splice(lastUnpinnedIdx, 1)
            }
          }
          s.tabs.push(newTab)
          s.activeTabId = id
          s.activeNoteId = id
        })
      }
      persistNotePrefs(get)
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get()
      const idx = tabs.findIndex((t) => t.id === id)
      if (idx === -1) return
      const remaining = tabs.filter((t) => t.id !== id)
      let nextActiveId: string | null = null
      if (activeTabId === id) {
        if (remaining.length > 0) {
          const nextIdx = Math.min(idx, remaining.length - 1)
          nextActiveId = remaining[nextIdx].id
        }
      } else {
        nextActiveId = activeTabId
      }
      set({ tabs: remaining, activeTabId: nextActiveId, activeNoteId: nextActiveId })
      persistNotePrefs(get)
    },

    switchTab: (id) => {
      const { tabs } = get()
      if (!tabs.some((t) => t.id === id)) return
      set({ activeTabId: id, activeNoteId: id })
      persistNotePrefs(get)
    },

    deactivateTab: () => {
      set({ activeTabId: null, activeNoteId: null })
      persistNotePrefs(get)
    },

    pinTab: (id) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.id === id)
        if (!tab) return
        tab.pinned = !tab.pinned
        const pinned = s.tabs.filter((t) => t.pinned)
        const unpinned = s.tabs.filter((t) => !t.pinned)
        s.tabs = [...pinned, ...unpinned]
      })
      persistNotePrefs(get)
    },

    reorderTabs: (fromIdx, toIdx) => {
      set((s) => {
        const [moved] = s.tabs.splice(fromIdx, 1)
        s.tabs.splice(toIdx, 0, moved)
        const pinned = s.tabs.filter((t) => t.pinned)
        const unpinned = s.tabs.filter((t) => !t.pinned)
        s.tabs = [...pinned, ...unpinned]
      })
      persistNotePrefs(get)
    },

    closeOtherTabs: (id) => {
      const tab = get().tabs.find((t) => t.id === id)
      if (!tab) return
      set((s) => {
        s.tabs = s.tabs.filter((t) => t.id === id || t.pinned)
      })
      const newActive = get().tabs.find((t) => t.id === id) ? id : get().tabs[0]?.id ?? null
      set({ activeTabId: newActive, activeNoteId: newActive })
      persistNotePrefs(get)
    },

    closeUnpinnedTabs: () => {
      set((s) => {
        s.tabs = s.tabs.filter((t) => t.pinned)
      })
      const newActive = get().tabs[0]?.id ?? null
      set({ activeTabId: newActive, activeNoteId: newActive })
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

    setTocMaxLevel: (level) => {
      set({ tocMaxLevel: Math.max(1, Math.min(6, level)) })
      persistNotePrefs(get)
    },
  }))
)

function persistNotePrefs(get: () => NoteStore) {
  store.set('notePrefs', {
    sortBy: get().sortBy,
    viewMode: get().viewMode,
    editorMode: get().editorMode,
    tocMaxLevel: get().tocMaxLevel,
    tabs: get().tabs,
    activeTabId: get().activeTabId,
  })
}
