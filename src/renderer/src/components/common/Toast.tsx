import { useState, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface ToastItem {
  id: number
  message: string
}

let toastCounter = 0

export function useToast() {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const showToast = useCallback((message: string, duration = 2000) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const id = ++toastCounter
    setToast({ id, message })
    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  const ToastContainer = useCallback(() => (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              font: 'var(--text-caption-3)',
              color: 'var(--accent-green)',
              background: 'rgba(48, 209, 88, 0.08)',
              border: '0.5px solid rgba(48, 209, 88, 0.15)',
              padding: '3px 12px',
              borderRadius: 'var(--radius-full)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {toast.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  ), [toast])

  return { showToast, ToastContainer }
}
