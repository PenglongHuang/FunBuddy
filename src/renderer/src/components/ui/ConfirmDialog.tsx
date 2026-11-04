import { motion, AnimatePresence } from 'motion/react'
import useEscapeToCancel from '@/hooks/useEscapeToCancel'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '删除',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEscapeToCancel(open, onCancel)

  return (
    <AnimatePresence>
      {open && (
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
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 280,
              maxWidth: 'calc(100vw - 48px)',
              background: 'var(--bg-secondary)',
              borderRadius: 20,
              padding: 20,
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{ font: 'var(--text-headline)', color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: 8 }}>
              {title}
            </span>
            <span style={{ font: 'var(--text-caption-1)', color: 'var(--text-secondary)', display: 'block', marginBottom: 20 }}>
              {message}
            </span>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onCancel}
                style={{
                  padding: '0 16px',
                  height: 34,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  padding: '0 20px',
                  height: 34,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--accent-pink)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
