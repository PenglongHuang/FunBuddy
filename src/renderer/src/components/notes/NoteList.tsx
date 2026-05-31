import { useNoteStore } from '@/stores/noteStore'
import { useToastStore } from '@/stores/toastStore'
import { Plus, Trash2, Pencil, Check, X as XIcon, FileText, Copy } from 'lucide-react'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { getTagColor, getAllTags } from '@/lib/tag-utils'
import { Button, ContextMenu, ConfirmDialog, TagBadge, MoreButton } from '@/components/ui'

export default function NoteList() {
  const notes = useNoteStore((s) => s.notes)
  const createNote = useNoteStore((s) => s.createNote)
  const deleteNote = useNoteStore((s) => s.deleteNote)
  const activeNoteId = useNoteStore((s) => s.activeNoteId)
  const setActiveNote = useNoteStore((s) => s.setActiveNote)
  const renameTag = useNoteStore((s) => s.renameTag)
  const deleteTag = useNoteStore((s) => s.deleteTag)
  const duplicateNote = useNoteStore((s) => s.duplicateNote)

  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [manageMode, setManageMode] = useState(false)
  const [renamingTag, setRenamingTag] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ noteId: string; rect: DOMRect } | null>(null)

  const allTags = useMemo(() => getAllTags(notes), [notes])

  const filteredNotes = useMemo(() => {
    if (activeTag === null) return notes
    return notes.filter((n) => (n.tags ?? []).includes(activeTag))
  }, [notes, activeTag])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    const note = await createNote(newTitle.trim())
    setNewTitle('')
    setShowNew(false)
    setActiveNote(note.id)
  }

  const handleRenameConfirm = async () => {
    if (!renamingTag || !renameValue.trim()) return
    await renameTag(renamingTag, renameValue.trim())
    if (activeTag === renamingTag) setActiveTag(renameValue.trim())
    setRenamingTag(null)
    setRenameValue('')
  }

  const handleDeleteTag = async () => {
    if (!deleteTarget) return
    await deleteTag(deleteTarget)
    if (activeTag === deleteTarget) setActiveTag(null)
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-tertiary)' }}>
          {filteredNotes.length} 个笔记
        </span>
        <div className="flex items-center gap-1">
          {allTags.length > 0 && (
            <Button variant="ghost" onClick={() => { setManageMode(!manageMode); setRenamingTag(null) }}>
              {manageMode ? '完成' : '管理标签'}
            </Button>
          )}
          <Button
            variant="primary"
            icon={<Plus size={13} strokeWidth={2.5} />}
            motionProps={{ whileTap: { scale: 0.92 }, whileHover: { scale: 1.04 } }}
            onClick={() => setShowNew(true)}
          >
            新建
          </Button>
        </div>
      </div>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div
          className="flex shrink-0"
          style={{
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-full)',
            padding: 2,
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {/* "全部" tab */}
          <motion.button
            onClick={() => setActiveTag(null)}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '5px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 11,
              fontWeight: activeTag === null ? 600 : 400,
              background: activeTag === null ? 'var(--bg-base)' : 'transparent',
              color: activeTag === null ? 'var(--text-primary)' : 'var(--text-tertiary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s ease, background 0.2s ease',
              boxShadow: activeTag === null ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            全部
          </motion.button>

          {/* Per-tag tabs */}
          {allTags.map((tag) => {
            const color = getTagColor(tag)
            const isActive = activeTag === tag
            const isRenaming = renamingTag === tag

            return (
              <div key={tag} style={{ display: 'flex', alignItems: 'center' }}>
                {isRenaming ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      padding: '3px 6px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--bg-secondary)',
                      border: '0.5px solid rgba(255,255,255,0.10)',
                    }}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameConfirm()
                        if (e.key === 'Escape') {
                          e.stopPropagation()
                          setRenamingTag(null)
                        }
                      }}
                      style={{
                        width: 60,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        font: 'var(--text-caption-1)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button
                      onClick={handleRenameConfirm}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-green)', padding: 0, display: 'flex' }}
                    >
                      <Check size={11} />
                    </button>
                    <button
                      onClick={() => setRenamingTag(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-quaternary)', padding: 0, display: 'flex' }}
                    >
                      <XIcon size={11} />
                    </button>
                  </div>
                ) : (
                  <motion.button
                    onClick={() => { if (!manageMode) setActiveTag(tag) }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 11,
                      fontWeight: isActive ? 600 : 400,
                      background: isActive ? 'var(--bg-base)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease, background 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {tag}
                  </motion.button>
                )}

                {manageMode && !isRenaming && (
                  <div style={{ display: 'flex', gap: 1, marginLeft: 1 }}>
                    <button
                      onClick={() => { setRenamingTag(tag); setRenameValue(tag) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-quaternary)', padding: 2, display: 'flex',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-blue)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-quaternary)' }}
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(tag)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-quaternary)', padding: 2, display: 'flex',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-pink)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-quaternary)' }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Note cards */}
      <div className="flex flex-col" style={{ gap: 4 }}>
        {filteredNotes.map((note) => (
          <motion.div
            key={note.id}
            onClick={() => setActiveNote(note.id)}
            whileTap={{ scale: 0.98 }}
            className="group cursor-pointer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: activeNoteId === note.id ? 'var(--bg-secondary)' : 'transparent',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (activeNoteId !== note.id) e.currentTarget.style.background = 'var(--bg-tertiary)'
            }}
            onMouseLeave={(e) => {
              if (activeNoteId !== note.id) e.currentTarget.style.background = 'transparent'
            }}
          >
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="truncate" style={{ font: 'var(--text-subhead)', color: 'var(--text-primary)', fontWeight: 500 }}>
                {note.title}
              </div>
              <div style={{ height: 1, margin: '5px 0', background: 'linear-gradient(to right, color-mix(in srgb, var(--text-quaternary) 20%, transparent), transparent)', borderRadius: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ font: 'var(--text-caption-2)', color: 'var(--text-quaternary)' }}>
                  {new Date(note.updatedAt).toLocaleDateString('zh-CN', {
                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {(note.tags ?? []).map((tag) => (
                      <TagBadge key={tag} tag={tag} variant="solid" />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* More button */}
            <MoreButton onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              setContextMenu({ noteId: note.id, rect })
            }} />
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      <AnimatePresence mode="wait">
        {filteredNotes.length === 0 && !showNew && (
          <motion.div
            key={activeTag ?? 'all'}
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
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-quaternary)' }}>
              {activeTag ? '该标签下暂无笔记' : '暂无笔记'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New note */}
      {showNew ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
          }}
        >
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="笔记标题"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              font: 'var(--text-body)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleCreate}
            style={{
              font: 'var(--text-caption-1)',
              fontWeight: 600,
              color: 'var(--accent-blue)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            确定
          </button>
          <button
            onClick={() => setShowNew(false)}
            style={{
              font: 'var(--text-caption-1)',
              color: 'var(--text-quaternary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            取消
          </button>
        </div>
      ) : (
        <motion.button
          onClick={() => setShowNew(true)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 0',
            font: 'var(--text-caption-1)',
            fontWeight: 500,
            color: 'var(--text-quaternary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            transition: 'color 0.2s ease, background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-blue)'
            e.currentTarget.style.background = 'rgba(10,132,255,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-quaternary)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Plus size={14} /> 新建笔记
        </motion.button>
      )}

      {/* Delete tag confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除标签"
        message={`确定要删除标签「${deleteTarget}」吗？该标签将从所有笔记中移除。`}
        onConfirm={handleDeleteTag}
        onCancel={() => setDeleteTarget(null)}
      />

      {contextMenu && (
        <ContextMenu
          items={[
            { label: '查看详情', icon: <FileText size={13} />, onClick: () => setActiveNote(contextMenu.noteId) },
            {
              label: '复制笔记',
              icon: <Copy size={13} />,
              onClick: async () => {
                const newNote = await duplicateNote(contextMenu.noteId)
                setContextMenu(null)
                setActiveNote(newNote.id)
                useToastStore.getState().show('复制笔记成功')
              },
            },
            { label: '删除笔记', icon: <Trash2 size={13} />, danger: true, onClick: () => deleteNote(contextMenu.noteId) },
          ]}
          anchorRect={contextMenu.rect}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
