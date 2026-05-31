import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigationStore } from '@/stores/navigationStore'

const SUGGESTIONS = [
  { icon: '🕐', text: '帮我总结今天的计划' },
  { icon: '🕐', text: '昨天写了什么笔记？' },
  { icon: '💡', text: '新建一个学习计划' },
  { icon: '💡', text: '开始 25 分钟专注' },
]

export default function AiSearchOverlay() {
  const isOpen = useNavigationStore((s) => s.isAiSearchOpen)
  const setAiSearchOpen = useNavigationStore((s) => s.setAiSearchOpen)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setAiSearchOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, setAiSearchOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            position: 'absolute',
            top: 36,
            left: 0,
            right: 72,
            bottom: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Backdrop */}
          <div
            style={{ position: 'absolute', inset: 0 }}
            onClick={() => setAiSearchOpen(false)}
          />

          {/* Content */}
          <div
            style={{
              position: 'relative',
              background: 'rgba(18,18,20,0.97)',
              borderBottom: '0.5px solid rgba(255,255,255,0.08)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Search input */}
            <div style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(0,122,255,0.3)',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 14, opacity: 0.6 }}>✨</span>
              <input
                ref={inputRef}
                placeholder="搜索或问 AI..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                }}
              />
              <span style={{
                color: 'rgba(255,255,255,0.2)',
                fontSize: 11,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 4,
                padding: '2px 6px',
                flexShrink: 0,
              }}>
                Esc 关闭
              </span>
            </div>

            {/* Suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SUGGESTIONS.map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    background: i === 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontSize: 11 }}>{s.icon}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              textAlign: 'center',
              fontSize: 11,
              color: 'rgba(255,255,255,0.2)',
              paddingTop: 4,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              AI 助手 · 未来接入
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
