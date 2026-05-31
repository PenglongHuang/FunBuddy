import { useState, useRef, useEffect } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'

interface TagContextMenuProps {
  tagName: string
  x: number
  y: number
  showRemoveFromItem?: boolean
  onRename: (oldName: string, newName: string) => void
  onDelete: (tagName: string) => void
  onRemoveFromItem?: (tagName: string) => void
  onClose: () => void
}

export default function TagContextMenu({
  tagName,
  x,
  y,
  showRemoveFromItem = false,
  onRename,
  onDelete,
  onRemoveFromItem,
  onClose,
}: TagContextMenuProps) {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(tagName)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (renaming) inputRef.current?.focus()
  }, [renaming])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleRenameConfirm = () => {
    const trimmed = newName.trim()
    if (trimmed && trimmed !== tagName) {
      onRename(tagName, trimmed)
    }
    onClose()
  }

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    color: 'var(--text-primary)',
    transition: 'background 0.1s ease',
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 200,
        background: 'rgba(44, 44, 46, 0.96)',
        backdropFilter: 'blur(40px)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: 4,
        minWidth: 150,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {renaming ? (
        <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm()
              if (e.key === 'Escape') {
                e.stopPropagation()
                onClose()
              }
            }}
            style={{
              flex: 1,
              fontSize: 12,
              background: 'var(--bg-tertiary)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: 6,
              padding: '4px 8px',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
      ) : (
        <>
          <button
            style={menuItemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            onClick={() => setRenaming(true)}
          >
            <Pencil size={12} style={{ opacity: 0.5 }} />
            重命名
          </button>
          {showRemoveFromItem && onRemoveFromItem && (
            <button
              style={menuItemStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              onClick={() => { onRemoveFromItem(tagName); onClose() }}
            >
              <X size={12} style={{ opacity: 0.5 }} />
              从此条移除
            </button>
          )}
          <div style={{ height: 1, background: 'var(--separator)', margin: '3px 8px' }} />
          <button
            style={{ ...menuItemStyle, color: '#FF375F' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,55,95,0.10)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            onClick={() => { onDelete(tagName); onClose() }}
          >
            <Trash2 size={12} />
            删除标签
          </button>
        </>
      )}
    </div>
  )
}
