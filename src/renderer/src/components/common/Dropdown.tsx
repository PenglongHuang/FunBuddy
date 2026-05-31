import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  open: boolean
  onClose: () => void
}

export default function Dropdown({ trigger, children, open, onClose }: DropdownProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const el = triggerRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      setAnchor({ top: rect.bottom + 4, left: rect.left })
    }
    const handleMouseDown = (e: MouseEvent) => {
      const popup = popupRef.current
      const trigger = triggerRef.current
      if (
        popup && popup.contains(e.target as Node)
        || trigger && trigger.contains(e.target as Node)
      ) return
      onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <span ref={triggerRef}>{trigger}</span>
      <AnimatePresence>
        {open && anchor && (
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'fixed',
              top: anchor.top,
              left: anchor.left,
              background: 'rgba(35,35,38,0.98)',
              backdropFilter: 'blur(20px)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '8px 10px',
              zIndex: 9999,
              minWidth: 140,
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
