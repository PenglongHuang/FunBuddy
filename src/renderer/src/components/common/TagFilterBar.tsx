import { useState } from 'react'
import { motion } from 'motion/react'
import { getTagColor } from '@/lib/tag-utils'
import TagContextMenu from './TagContextMenu'

interface TagFilterItem {
  name: string
  count: number
}

interface TagFilterBarProps {
  tags: TagFilterItem[]
  activeTag: string | null
  onSelect: (tag: string | null) => void
  onRenameTag?: (oldName: string, newName: string) => void
  onDeleteTag?: (tagName: string) => void
}

export default function TagFilterBar({ tags, activeTag, onSelect, onRenameTag, onDeleteTag }: TagFilterBarProps) {
  const [contextMenu, setContextMenu] = useState<{ tagName: string; x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent, tagName: string) => {
    if (!onRenameTag && !onDeleteTag) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ tagName, x: e.clientX, y: e.clientY })
  }

  const color = getTagColor()

  return (
    <div
      className="flex shrink-0"
      style={{
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-full)',
        padding: 2,
        gap: 1,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      <style>{`.tag-filter-scroll::-webkit-scrollbar{display:none}`}</style>
      <div className="flex tag-filter-scroll" style={{ gap: 1, minWidth: '100%' }}>
        <motion.button
          onClick={() => onSelect(null)}
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
            flexShrink: 0,
            boxShadow: activeTag === null ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          全部
        </motion.button>
        {tags.map(({ name }) => {
          const isActive = activeTag === name
          return (
            <motion.button
              key={name}
              onClick={() => onSelect(isActive ? null : name)}
              onContextMenu={(e) => handleContextMenu(e, name)}
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
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {name}
              </span>
            </motion.button>
          )
        })}
      </div>

      {contextMenu && (
        <TagContextMenu
          tagName={contextMenu.tagName}
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={(oldName, newName) => onRenameTag?.(oldName, newName)}
          onDelete={(tagName) => onDeleteTag?.(tagName)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
