import { useEffect, useState, useMemo } from 'react'
import { useNoteStore } from '@/stores/noteStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { Plus, Trash2, CheckSquare, Square, FileText, Download, Copy } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useToastStore } from '@/stores/toastStore'
import NoteEditor from './NoteEditor'
import { Button, ContextMenu, ConfirmDialog } from '@/components/ui'
import SearchBar from '@/components/common/SearchBar'
import NoteToolbar from './NoteToolbar'
import NoteCard from './NoteCard'
import ExportDialog from '@/components/common/ExportDialog'
import { buildExportHtml, type ExportMode } from '@/lib/export-pdf'
import { pdfExport } from '@/lib/ipc'

export default function NotesPanel() {
  const notes = useNoteStore((s) => s.notes)
  const loaded = useNoteStore((s) => s.loaded)
  const activeNoteId = useNoteStore((s) => s.activeNoteId)
  const load = useNoteStore((s) => s.load)
  const createNote = useNoteStore((s) => s.createNote)
  const deleteNote = useNoteStore((s) => s.deleteNote)
  const deleteNotes = useNoteStore((s) => s.deleteNotes)
  const duplicateNote = useNoteStore((s) => s.duplicateNote)
  const setActiveNote = useNoteStore((s) => s.setActiveNote)
  const loadNoteContent = useNoteStore((s) => s.loadNoteContent)
  const navPush = useNavigationStore((s) => s.push)

  const tabs = useNoteStore((s) => s.tabs)
  const activeTabId = useNoteStore((s) => s.activeTabId)

  const sortBy = useNoteStore((s) => s.sortBy)
  const viewMode = useNoteStore((s) => s.viewMode)
  const setSortBy = useNoteStore((s) => s.setSortBy)
  const setViewMode = useNoteStore((s) => s.setViewMode)

  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'batch'; id?: string } | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ noteId: string; rect: DOMRect } | null>(null)
  const [exportTarget, setExportTarget] = useState<{ noteId: string; title: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { load() }, [load])

  const filteredNotes = useMemo(() => {
    let result = notes
    if (activeTag !== null) {
      result = result.filter((n) => (n.tags ?? []).includes(activeTag))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        (n.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    }
    return result
  }, [notes, activeTag, searchQuery])

  const sortedNotes = useMemo(() => {
    const sorted = [...filteredNotes]
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
        break
      default:
        sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
    return sorted
  }, [filteredNotes, sortBy])

  const handleCreate = async () => {
    const note = await createNote('新笔记')
    navPush({ panel: 'notes', subView: 'editor', noteId: note.id })
    useToastStore.getState().show('新建笔记成功')
  }

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
  }

  const handleExportPdf = async (noteId: string, mode: ExportMode) => {
    const note = notes.find((n) => n.id === noteId)
    if (!note) return
    try {
      const content = await loadNoteContent(noteId)
      const html = await buildExportHtml({
        content: content || '',
        mdFilePath: note.filePath,
        title: note.title,
        mode,
        fileName: `${note.title}.pdf`,
        meta: {
          tags: note.tags,
          createdAt: note.createdAt?.slice(0, 10),
        },
      })
      const result = await pdfExport.generate(html, `${note.title}.pdf`)
      setExportTarget(null)
      if (result.success && 'filePath' in result) {
        useToastStore.getState().show('PDF 导出成功')
      } else if (!result.success) {
        useToastStore.getState().show('导出失败: ' + result.error)
      }
    } catch (err: any) {
      setExportTarget(null)
      useToastStore.getState().show('导出失败: ' + (err.message || String(err)))
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

  if (tabs.length > 0 && activeTabId) {
    return <NoteEditor />
  }

  return (
    <div className="flex flex-col h-full" style={{ gap: 0, position: 'relative' }}>
      {/* TitleBar */}
      <div className="flex items-center justify-between shrink-0" style={{ padding: '6px 12px' }}>
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
            <Button variant="secondary" onClick={exitEditMode}>取消</Button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: '#8e8e93' }}>
              {searchQuery ? `搜索 "${searchQuery}" · ${sortedNotes.length} 个结果` : `${sortedNotes.length} 条笔记`}
            </span>
            <div className="flex items-center gap-1">
              {notes.length > 0 && (
                <Button variant="ghost" onClick={() => setEditMode(true)}>管理</Button>
              )}
              <Button
                variant="primary"
                icon={<Plus size={13} strokeWidth={2.5} />}
                onClick={handleCreate}
              >
                新建
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Search — hidden during edit mode */}
      {!editMode && (
        <SearchBar placeholder="搜索笔记标题或标签..." value={searchQuery} onChange={setSearchQuery} />
      )}

      {/* Toolbar — hidden during edit mode */}
      {!editMode && notes.length > 0 && (
        <>
          <NoteToolbar
            notes={filteredNotes}
            activeFilterTag={activeTag}
            onActiveFilterTagChange={setActiveTag}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            editMode={editMode}
          />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 12px' }} />
        </>
      )}

      {/* Card list */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{
        display: viewMode === 'compact' ? 'grid' : 'flex',
        flexDirection: 'column',
        ...(viewMode === 'compact'
          ? { gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, alignContent: 'start' }
          : { gap: 8, padding: '0 12px' }),
      }}>
        {sortedNotes.length === 0 && !editMode ? (
          <motion.div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <FileText size={28} style={{ color: '#48484a', opacity: 0.4 }} strokeWidth={1.2} />
            <span style={{ fontSize: 12, color: '#48484a' }}>
              {searchQuery ? '未找到匹配的笔记' : activeTag ? '该标签下暂无笔记' : '暂无笔记'}
            </span>
          </motion.div>
        ) : (
          sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              viewMode={viewMode}
              isActive={activeNoteId === note.id}
              isSelected={selectedIds.has(note.id)}
              editMode={editMode}
              searchQuery={searchQuery || undefined}
              onMoreClick={(noteId, rect) => setContextMenu({ noteId, rect })}
              onClick={(id) => {
                useNoteStore.getState().openTab(id)
                navPush({ panel: 'notes', subView: 'editor', noteId: id })
              }}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
      </div>

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
            <Button
              variant="danger"
              motionProps={{ whileTap: { scale: 0.95 } }}
              onClick={handleBatchDelete}
            >
              删除
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB — hidden during edit mode */}
      {!editMode && (
        <div onClick={handleCreate} style={{
          position: 'absolute', bottom: 16, right: 16,
          width: 38, height: 38, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0A84FF, #5856D6)',
          boxShadow: '0 4px 14px rgba(10,132,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 18, color: '#fff', fontWeight: 300,
          zIndex: 10,
        }}>＋</div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message={deleteTarget?.type === 'batch'
          ? `确定要删除选中的 ${selectedIds.size} 条笔记吗？此操作不可撤销。`
          : '确定要删除这条笔记吗？此操作不可撤销。'}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {contextMenu && (
        <ContextMenu
          items={[
            { label: '查看详情', icon: <FileText size={13} />, onClick: () => navPush({ panel: 'notes', subView: 'editor', noteId: contextMenu.noteId }) },
            {
              label: '导出 PDF',
              icon: <Download size={13} />,
              onClick: () => {
                const note = notes.find((n) => n.id === contextMenu.noteId)
                if (note) setExportTarget({ noteId: contextMenu.noteId, title: note.title })
                setContextMenu(null)
              },
            },
            {
              label: '复制笔记',
              icon: <Copy size={13} />,
              onClick: async () => {
                const newNote = await duplicateNote(contextMenu.noteId)
                setContextMenu(null)
                navPush({ panel: 'notes', subView: 'editor', noteId: newNote.id })
                useToastStore.getState().show('复制笔记成功')
              },
            },
            { label: '删除笔记', icon: <Trash2 size={13} />, danger: true, onClick: () => setDeleteTarget({ type: 'single', id: contextMenu.noteId }) },
          ]}
          anchorRect={contextMenu.rect}
          onClose={() => setContextMenu(null)}
        />
      )}

      {exportTarget && (
        <ExportDialog
          open
          onClose={() => setExportTarget(null)}
          onExport={(mode) => handleExportPdf(exportTarget.noteId, mode)}
        />
      )}
    </div>
  )
}
