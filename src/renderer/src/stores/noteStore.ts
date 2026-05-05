import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { fs, store } from '@/lib/ipc'
import type { Note } from '@/types/note'


interface NoteStore {
  notes: Note[]
  loaded: boolean
  activeNoteId: string | null
  sortBy: 'time' | 'name'
  viewMode: 'list' | 'card' | 'compact'
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
  setActiveNote: (id: string | null) => void
  setSortBy: (sort: 'time' | 'name') => void
  setViewMode: (mode: 'list' | 'card' | 'compact') => void
}

export const useNoteStore = create<NoteStore>()(
  immer((set, get) => ({
    notes: [],
    loaded: false,
    activeNoteId: null,
    sortBy: 'time',
    viewMode: 'card',

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
        set({ notes: validNotes, loaded: true })
      } catch {
        set({ notes: [], loaded: true })
      }

      const prefs = await store.get<{ sortBy: string; viewMode: string }>('notePrefs')
      if (prefs) {
        set({ sortBy: (prefs.sortBy as any) ?? 'time', viewMode: (prefs.viewMode as any) ?? 'card' })
      }
    },

    createNote: async (title, content = '', tags) => {
      const id = nanoid(8)
      const slug = title.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').slice(0, 20)
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
        try { await fs.deleteFile(note.filePath) } catch {}
      }
      set((s) => { s.notes = s.notes.filter((n) => n.id !== id) })
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
    },

    deleteNotes: async (ids) => {
      const idSet = new Set(ids)
      const notes = get().notes
      for (const note of notes) {
        if (idSet.has(note.id)) {
          try { await fs.deleteFile(note.filePath) } catch { /* already deleted */ }
        }
      }
      set((s) => { s.notes = s.notes.filter((n) => !idSet.has(n.id)) })
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
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
      set((s) => {
        const note = s.notes.find((n) => n.id === id)
        if (!note) return
        note.title = title
        note.updatedAt = new Date().toISOString()
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

    setActiveNote: (id) => set({ activeNoteId: id }),

    setSortBy: (sort) => {
      set({ sortBy: sort })
      store.set('notePrefs', { sortBy: sort, viewMode: get().viewMode })
    },

    setViewMode: (mode) => {
      set({ viewMode: mode })
      store.set('notePrefs', { sortBy: get().sortBy, viewMode: mode })
    },
  }))
)
