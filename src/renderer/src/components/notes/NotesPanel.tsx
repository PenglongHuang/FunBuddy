import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNoteStore } from '@/stores/noteStore'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import MarkdownPreview from '@/components/common/MarkdownPreview'
import { Plus, Trash2, Eye, Edit3, FileText, CheckSquare, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import TagFilterBar from '@/components/common/TagFilterBar'
import TagInput from '@/components/common/TagInput'
import { getTagColor, getAllTags } from '@/lib/tag-utils'
import { usePlanStore } from '@/stores/planStore'

export default function NotesPanel() {
  const notes = useNoteStore((s) => s.notes)
  const loaded = useNoteStore((s) => s.loaded)
  const activeNoteId = useNoteStore((s) => s.activeNoteId)
  const load = useNoteStore((s) => s.load)
  const createNote = useNoteStore((s) => s.createNote)
  const deleteNote = useNoteStore((s) => s.deleteNote)
  const deleteNotes = useNoteStore((s) => s.deleteNotes)
  const saveNoteContent = useNoteStore((s) => s.saveNoteContent)
  const loadNoteContent = useNoteStore((s) => s.loadNoteContent)
  const updateNoteTags = useNoteStore((s) => s.updateNoteTags)
  const setActiveNote = useNoteStore((s) => s.setActiveNote)
  const renameNoteTag = useNoteStore((s) => s.renameTag)
  const deleteNoteTag = useNoteStore((s) => s.deleteTag)
  const renamePlanTag = usePlanStore((s) => s.renameTag)
  const deletePlanTag = usePlanStore((s) => s.deleteTag)

  const [content, setContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'batch'; id?: string } | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  useEffect(() => { load() }, [load])

  const activeNote = notes.find((n) => n.id === activeNoteId)

  const allTags = useMemo(() => getAllTags(notes), [notes])
  const tagFilterItems = useMemo(() =>
    allTags.map((name) => ({
      name,
      count: notes.filter((n) => (n.tags ?? []).includes(name)).length,
    })),
    [allTags, notes],
  )
  const filteredNotes = useMemo(() => {
    if (activeTag === null) return notes
    return notes.filter((n) => (n.tags ?? []).includes(activeTag))
  }, [notes, activeTag])

  useEffect(() => {
    if (activeNoteId) {
      loadNoteContent(activeNoteId).then(setContent)
    } else {
      setContent('')
    }
  }, [activeNoteId, loadNoteContent])

  const handleSave = useCallback(async () => {
    if (!activeNoteId) return
    setSaving(true)
    await saveNoteContent(activeNoteId, content)
    setSaving(false)
    setEditing(false)
  }, [activeNoteId, content, saveNoteContent])

  const handleCreate = async () => {
    const note = await createNote('新笔记')
    setActiveNote(note.id)
    setEditing(true)
  }

  const handleRenameTag = useCallback(async (oldName: string, newName: string) => {
    await Promise.all([renameNoteTag(oldName, newName), renamePlanTag(oldName, newName)])
  }, [renameNoteTag, renamePlanTag])

  const handleDeleteTag = useCallback(async (tagName: string) => {
    await Promise.all([deleteNoteTag(tagName), deletePlanTag(tagName)])
  }, [deleteNoteTag, deletePlanTag])

  const visibleIds = useMemo(() => new Set(filteredNotes.map((n) => n.id)), [filteredNotes])
  const allSelected = filteredNotes.length > 0 && filteredNotes.every((n) => selectedIds.has(n.id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        visibleIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        visibleIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return
    setDeleteTarget({ type: 'batch' })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'single' && deleteTarget.id) {
      await deleteNote(deleteTarget.id)
      if (activeNoteId === deleteTarget.id) setActiveNote(null)
    } else if (deleteTarget.type === 'batch') {
      await deleteNotes(Array.from(selectedIds))
      if (activeNoteId && selectedIds.has(activeNoteId)) setActiveNote(null)
      setSelectedIds(new Set())
      setEditMode(false)
    }
    setDeleteTarget(null)
    if (activeTag !== null) {
      const remaining = notes.filter((n) => (n.tags ?? []).includes(activeTag))
      if (remaining.length === 0) setActiveTag(null)
    }
  }

  const exitEditMode = () => {
    setEditMode(false)
    setSelectedIds(new Set())
  }

  if (!loaded) {
    return (
      <div style={{ font: 'var(--text-caption-1)', color: 'var(--text-quaternary)', textAlign: 'center', padding: '32px 0' }}>
        加载中...
      </div>
    )
  }

  if (activeNote) {
    return (
      <div className="flex flex-col h-full gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            onClick={() => setActiveNote(null)}
            whileTap={{ scale: 0.95 }}
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ← 返回
          </motion.button>
          <span
            className="truncate flex-1"
            style={{ font: 'var(--text-caption-1)', color: 'var(--text-primary)', fontWeight: 500 }}
          >
            {activeNote.title}
          </span>
          <motion.button
            onClick={() => setEditing((e) => !e)}
            whileTap={{ scale: 0.9 }}
            title={editing ? '预览' : '编辑'}
            style={{
              padding: 4,
              borderRadius: 'var(--radius-sm)',
              background: editing ? 'rgba(10,132,255,0.15)' : 'transparent',
              color: editing ? 'var(--accent-blue)' : 'var(--text-tertiary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            {editing ? <Eye size={14} /> : <Edit3 size={14} />}
          </motion.button>
        </div>

        {/* Tag management */}
        <TagInput
          tags={activeNote.tags ?? []}
          allTags={allTags}
          onUpdateTags={(tags) => { if (activeNoteId) updateNoteTags(activeNoteId, tags) }}
        />

        {/* Editor / Preview */}
        <div className="flex-1 min-h-0">
          {editing ? (
            <MarkdownEditor value={content} onChange={setContent} placeholder="开始书写..." />
          ) : (
            <MarkdownPreview content={content} />
          )}
        </div>

        {/* Save button */}
        {editing && (
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              cursor: saving ? 'wait' : 'pointer',
              alignSelf: 'flex-end',
              opacity: saving ? 0.6 : 1,
              boxShadow: '0 2px 8px rgba(10,132,255,0.25)',
            }}
          >
            {saving ? '保存中...' : '保存'}
          </motion.button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ gap: 6 }}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        {editMode ? (
          <>
            <button
              onClick={toggleSelectAll}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 'var(--radius-sm)',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,132,255,0.10)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
              <span style={{ fontSize: 12, fontWeight: 500 }}>全选</span>
            </button>
            <button
              onClick={exitEditMode}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 500,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          </>
        ) : (
          <>
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-tertiary)' }}>
              {filteredNotes.length} 条笔记
            </span>
            <div className="flex items-center gap-1">
              {notes.length > 0 && (
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'color 0.15s ease, background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent-blue)'
                    e.currentTarget.style.background = 'rgba(10,132,255,0.10)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-tertiary)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  管理
                </button>
              )}
              <motion.button
                onClick={handleCreate}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.04 }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 2px 8px rgba(10,132,255,0.25)',
                }}
              >
                <Plus size={13} strokeWidth={2.5} />
                新建
              </motion.button>
            </div>
          </>
        )}
      </div>

      {/* Tag filter bar */}
      {tagFilterItems.length > 0 && (
        <TagFilterBar
          tags={tagFilterItems}
          activeTag={activeTag}
          onSelect={setActiveTag}
          onRenameTag={handleRenameTag}
          onDeleteTag={handleDeleteTag}
        />
      )}

      {/* Note cards */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col" style={{ gap: 4 }}>
        {filteredNotes.map((note) => {
          const isSelected = selectedIds.has(note.id)
          return (
            <motion.div
              key={note.id}
              onClick={() => {
                if (editMode) toggleSelect(note.id)
                else setActiveNote(note.id)
              }}
              whileTap={{ scale: 0.98 }}
              className="group"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: isSelected
                  ? 'rgba(10,132,255,0.06)'
                  : 'var(--bg-secondary)',
                border: isSelected
                  ? '0.5px solid rgba(10,132,255,0.20)'
                  : '0.5px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                transition: 'background 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!editMode) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                }
              }}
              onMouseLeave={(e) => {
                if (!editMode) {
                  e.currentTarget.style.background = 'var(--bg-secondary)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'
                }
              }}
            >
              {/* Left: checkbox or icon */}
              {editMode ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(note.id) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: isSelected ? 'var(--accent-blue)' : 'var(--text-quaternary)',
                    flexShrink: 0,
                    transition: 'color 0.15s ease',
                  }}
                >
                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              ) : (
                <div style={{ flexShrink: 0, color: note.color, display: 'flex' }}>
                  <FileText size={14} color={note.color} />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <span
                  className="truncate"
                  style={{
                    font: 'var(--text-caption-1)',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                  }}
                >
                  {note.title}
                </span>
                <div style={{ font: 'var(--text-caption-2)', color: 'var(--text-quaternary)', marginTop: 3 }}>
                  {new Date(note.updatedAt).toLocaleDateString('zh-CN')}
                </div>
                {(note.tags ?? []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' as const }}>
                    {(note.tags ?? []).slice(0, 3).map((tag) => {
                      const tc = getTagColor()
                      return (
                        <span key={tag} style={{
                          fontSize: 10,
                          fontWeight: 500,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)',
                          background: `${tc}22`,
                          color: tc,
                        }}>
                          {tag}
                        </span>
                      )
                    })}
                    {(note.tags ?? []).length > 3 && (
                      <span style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>
                        +{(note.tags ?? []).length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Delete */}
              {!editMode && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'single', id: note.id }) }}
                  style={{
                    opacity: 0,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-quaternary)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 'var(--radius-sm)',
                    transition: 'opacity 0.15s ease, color 0.15s ease',
                    flexShrink: 0,
                  }}
                  className="group-hover:opacity-100"
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-pink)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-quaternary)' }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Empty state */}
      <AnimatePresence mode="wait">
        {filteredNotes.length === 0 && !editMode && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              textAlign: 'center',
              padding: '32px 0 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileText size={28} style={{ color: 'var(--text-quaternary)', opacity: 0.4 }} strokeWidth={1.2} />
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-quaternary)' }}>
              {activeTag ? '该标签下暂无笔记' : '暂无笔记'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch delete action bar */}
      <AnimatePresence>
        {editMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              border: '0.5px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              已选 {selectedIds.size} 项
            </span>
            <motion.button
              onClick={handleBatchDelete}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: '5px 16px',
                borderRadius: 'var(--radius-full)',
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--accent-pink)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255,55,95,0.20)',
              }}
            >
              删除
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 280,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-xl)',
                padding: 20,
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}
            >
              <span style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                确认删除
              </span>
              <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-secondary)', display: 'block', marginBottom: 20 }}>
                {deleteTarget.type === 'batch'
                  ? `确定要删除选中的 ${selectedIds.size} 条笔记吗？此操作不可撤销。`
                  : '确定要删除这条笔记吗？此操作不可撤销。'}
              </span>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  style={{
                    padding: '0 16px',
                    height: 34,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 500,
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    padding: '0 20px',
                    height: 34,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 600,
                    background: 'var(--accent-pink)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
