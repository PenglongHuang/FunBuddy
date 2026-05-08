import { useEffect, useRef, useState, useMemo } from 'react'
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

const SubmenuPanel = React.forwardRef<HTMLDivElement, {
  items: ContextMenuItem[]
  parentRect: DOMRect
  onClose: () => void
}>(({ items, parentRect, onClose }, ref) => {
  const submenuStyle: React.CSSProperties = useMemo(() => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const menuWidth = 160
    const menuHeight = Math.min(items.length * 36 + 8, 400)

    let right = viewportWidth - parentRect.right + 4
    let top = parentRect.top

    if (parentRect.right + menuWidth > viewportWidth - 8) {
      right = viewportWidth - parentRect.left + menuWidth + 4
    }
    if (top + menuHeight > viewportHeight - 8) {
      top = viewportHeight - menuHeight - 8
    }

    return {
      position: 'fixed' as const,
      top,
      right,
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
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    right: window.innerWidth - anchorRect.right,
  }

  let hadDanger = false

  return (
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
                onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
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
      {activeSubmenu && submenuAnchor && createPortal(
        <SubmenuPanel
          items={activeSubmenu}
          parentRect={submenuAnchor}
          onClose={onClose}
          ref={submenuRef}
        />,
        document.body
      )}
    </AnimatePresence>
  )
}
