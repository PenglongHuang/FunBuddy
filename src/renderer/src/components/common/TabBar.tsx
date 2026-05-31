import { useState, useCallback } from 'react'
import { Pin, X } from 'lucide-react'
import { ContextMenu } from '@/components/ui'
import type { Tab } from '@/types/tab'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onBeforeClose?: (id: string) => boolean  // return false to cancel close
  onPin: (id: string) => void
  onReorder: (fromIdx: number, toIdx: number) => void
  onCloseOthers: (id: string) => void
  onCloseUnpinned: () => void
}

export default function TabBar({
  tabs, activeTabId, onSelect, onClose, onBeforeClose, onPin, onReorder, onCloseOthers, onCloseUnpinned,
}: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<{ tabId: string; rect: DOMRect } | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const handleClose = useCallback((id: string) => {
    if (onBeforeClose && !onBeforeClose(id)) return
    onClose(id)
  }, [onBeforeClose, onClose])

  const handleDragStart = useCallback((idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((idx: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (dragIdx === null) return
    // Don't allow cross-group drags (pinned <-> unpinned)
    if (tabs[dragIdx].pinned !== tabs[idx].pinned && dragIdx !== idx) return
    setDragOverIdx(idx)
  }, [dragIdx, tabs])

  const handleDrop = useCallback((idx: number) => () => {
    if (dragIdx !== null && dragIdx !== idx) {
      onReorder(dragIdx, idx)
    }
    setDragIdx(null)
    setDragOverIdx(null)
  }, [dragIdx, onReorder])

  const handleDragEnd = useCallback(() => {
    setDragIdx(null)
    setDragOverIdx(null)
  }, [])

  const handleContextMenu = useCallback((tabId: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ tabId, rect: (e.target as HTMLElement).getBoundingClientRect() })
  }, [])

  if (tabs.length === 0) return null

  const contextTab = tabs.find((t) => t.id === contextMenu?.tabId)

  return (
    <>
      <div
        className="flex shrink-0"
        style={{
          gap: 2,
          padding: '4px 4px 0',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId
          const isDragging = dragIdx === idx
          const showDropIndicator = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx

          return (
            <div key={tab.id} className="flex items-center" style={{ position: 'relative' }}>
              {showDropIndicator && (
                <div style={{
                  width: 2,
                  background: '#0A84FF',
                  borderRadius: 1,
                  margin: '0 1px',
                  alignSelf: 'stretch',
                }} />
              )}
              <button
                title={tab.title}
                onClick={() => onSelect(tab.id)}
                onContextMenu={handleContextMenu(tab.id)}
                draggable
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDrop={handleDrop(idx)}
                onDragEnd={handleDragEnd}
                style={{
                  padding: '7px 12px',
                  borderRadius: '0 0 6px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap' as const,
                  background: isActive ? 'var(--bg-secondary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  minWidth: 0,
                  opacity: isDragging ? 0.4 : 1,
                  borderTop: isActive ? '2px solid #0A84FF' : '2px solid transparent',
                  transition: 'background 0.15s ease, color 0.15s ease',
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-tertiary)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                {tab.pinned && <Pin size={11} style={{ flexShrink: 0, color: '#0A84FF' }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: '1 1 0' }}>{tab.title}</span>
                {!tab.pinned && isActive && (
                  <span
                    onClick={(e) => { e.stopPropagation(); handleClose(tab.id) }}
                    style={{
                      color: 'var(--text-quaternary)',
                      fontSize: 10,
                      marginLeft: 4,
                      cursor: 'pointer',
                      flexShrink: 0,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-quaternary)' }}
                  >
                    <X size={11} />
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {contextMenu && contextTab && (
        <ContextMenu
          items={[
            {
              label: contextTab.pinned ? '取消固定' : '固定 Tab',
              icon: <Pin size={13} />,
              onClick: () => onPin(contextTab.id),
            },
            ...(!contextTab.pinned ? [{
              label: '关闭',
              icon: <X size={13} />,
              onClick: () => handleClose(contextTab.id),
            }] : []),
            { label: '关闭其他', onClick: () => onCloseOthers(contextTab.id) },
            { label: '关闭所有未固定', onClick: onCloseUnpinned },
          ]}
          anchorRect={contextMenu.rect}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
