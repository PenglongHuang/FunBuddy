import { useEffect, useRef, useState, useMemo, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  danger?: boolean
  textColor?: string
  hoverColor?: string
  onClick: () => void
  submenu?: ContextMenuItem[]
  disabled?: boolean
  shortcut?: string
  isGroupHeader?: boolean
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  anchorRect: DOMRect
  onClose: () => void
}

const menuContainerStyle: React.CSSProperties = {
  background: 'rgba(58,58,60,0.98)',
  border: '0.5px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: 4,
  minWidth: 150,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 200,
}

function itemStyle(color?: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 6,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: color ?? 'rgba(255,255,255,0.7)',
    fontSize: 12,
    width: '100%',
    textAlign: 'left' as const,
    transition: 'background 0.15s ease',
  }
}

const SubmenuPanel = forwardRef<HTMLDivElement, {
  items: ContextMenuItem[]
  parentRect: DOMRect
  onClose: () => void
}>(({ items, parentRect, onClose }, ref) => {
  const submenuStyle: React.CSSProperties = useMemo(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const menuW = 160
    const menuH = Math.min(items.length * 36 + 8, 400)

    let left = parentRect.right + 4
    if (left + menuW > vw - 8) {
      left = parentRect.left - menuW - 4
    }
    left = Math.max(8, left)

    let top = parentRect.top
    if (top + menuH > vh - 8) {
      top = vh - menuH - 8
    }
    top = Math.max(8, top)

    return {
      position: 'fixed' as const,
      top,
      left,
      background: 'rgba(58,58,60,0.98)',
      border: '0.5px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: 4,
      minWidth: 140,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 200,
    }
  }, [items.length, parentRect])

  function subItemStyle(color?: string): React.CSSProperties {
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      borderRadius: 6,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer' as const,
      color: color ?? 'rgba(255,255,255,0.7)',
      fontSize: 12,
      width: '100%',
      textAlign: 'left' as const,
      transition: 'background 0.15s ease',
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        style={submenuStyle}
        initial={{ opacity: 0, scale: 0.95, x: -4 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.95, x: -4 }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
            onMouseEnter={(e) => {
              if (item.disabled) return
              e.currentTarget.style.background = item.danger
                ? 'rgba(255,55,95,0.1)'
                : item.hoverColor ?? 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            style={{
              ...subItemStyle(item.danger ? 'rgba(255,55,95,0.8)' : item.textColor),
              opacity: item.disabled ? 0.35 : 1,
              cursor: item.disabled ? 'not-allowed' as const : 'pointer' as const,
            }}
          >
            {item.icon}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 16 }}>
                {item.shortcut}
              </span>
            )}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  )
})

export default function ContextMenu({ items, anchorRect, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<ContextMenuItem[] | null>(null)
  const [submenuAnchor, setSubmenuAnchor] = useState<DOMRect | null>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target) &&
          (!submenuRef.current || !submenuRef.current.contains(target))) {
        onClose()
      }
    }
    // 与 Dropdown 一致的 document 级处理:菜单只在挂载期间存在(父组件条件渲染),
    // 打开时 Escape 关菜单并 stopPropagation,阻止 App 的全局监听把应用折叠成宠物模式
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const vw = window.innerWidth
  const vh = window.innerHeight
  const menuW = 180
  const menuH = Math.min(items.length * 34 + 8, vh - 16)

  let top = anchorRect.bottom + 4
  if (top + menuH > vh - 8) top = anchorRect.top - menuH - 4
  top = Math.max(8, Math.min(top, vh - menuH - 8))

  let left = anchorRect.left
  if (left + menuW > vw - 8) left = vw - menuW - 8
  left = Math.max(8, left)

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top,
    left,
  }

  let hadDanger = false

  return (
    <>
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        style={{ ...menuStyle, ...menuContainerStyle }}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        {items.map((item, i) => {
          const showSeparator = item.danger && !hadDanger
          if (item.danger) hadDanger = true

          if (item.isGroupHeader) {
            return (
              <div key={i}>
                {showSeparator && <div style={{ height: 0.5, background: 'rgba(255,255,255,0.08)', margin: '2px 8px' }} />}
                <div style={{
                  padding: '6px 12px',
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase' as const,
                  pointerEvents: 'none' as const,
                }}>
                  {item.label}
                </div>
              </div>
            )
          }

          return (
            <div key={i}>
              {showSeparator && <div style={{ height: 0.5, background: 'rgba(255,255,255,0.08)', margin: '2px 8px' }} />}
              <button
                onClick={(e) => {
                  if (item.disabled) return
                  if (item.submenu) {
                    setActiveSubmenu(item.submenu)
                    setSubmenuAnchor(e.currentTarget.getBoundingClientRect())
                    return
                  }
                  item.onClick()
                  onClose()
                }}
                onMouseEnter={(e) => {
                  if (item.disabled) return
                  if (item.submenu) {
                    setActiveSubmenu(item.submenu)
                    setSubmenuAnchor(e.currentTarget.getBoundingClientRect())
                  } else {
                    setActiveSubmenu(null)
                  }
                  e.currentTarget.style.background = item.danger
                    ? 'rgba(255,55,95,0.1)'
                    : item.hoverColor ?? 'rgba(255,255,255,0.06)'
                }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                style={{
                  ...itemStyle(item.danger ? 'rgba(255,55,95,0.8)' : item.textColor),
                  opacity: item.disabled ? 0.35 : 1,
                  cursor: item.disabled ? ('not-allowed' as const) : ('pointer' as const),
                }}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.shortcut && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 16 }}>
                    {item.shortcut}
                  </span>
                )}
                {item.submenu && item.submenu.length > 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>▸</span>
                )}
              </button>
            </div>
          )
        })}
      </motion.div>
      </AnimatePresence>
      {activeSubmenu && submenuAnchor && createPortal(
        <SubmenuPanel
          items={activeSubmenu}
          parentRect={submenuAnchor}
          onClose={onClose}
          ref={submenuRef}
        />,
        document.body
      )}
    </>
  )
}
