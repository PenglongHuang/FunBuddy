import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { FileDown, Loader2 } from 'lucide-react'
import type { ExportMode } from '@/lib/export-pdf'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: (mode: ExportMode) => Promise<void>
}

export default function ExportDialog({ open, onClose, onExport }: ExportDialogProps) {
  const [mode, setMode] = useState<ExportMode>('title-body')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await onExport(mode)
    } finally {
      setExporting(false)
    }
  }

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
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(44,44,46,0.98)',
              borderRadius: 12,
              padding: '20px 24px',
              width: 280,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>导出为 PDF</div>
              <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 4 }}>选择导出内容范围</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <Option
                label="标题 + 正文"
                desc="包含标题和正文内容"
                selected={mode === 'title-body'}
                onClick={() => setMode('title-body')}
              />
              <Option
                label="完整元数据 + 正文"
                desc="标题、标签、日期等 + 正文"
                selected={mode === 'full-metadata'}
                onClick={() => setMode('full-metadata')}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={exporting}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: '#8e8e93',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: exporting ? 'default' : 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  background: exporting ? '#2563eb' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: exporting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {exporting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileDown size={12} />
                )}
                {exporting ? '导出中...' : '导出'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Option({
  label,
  desc,
  selected,
  onClick,
}: {
  label: string
  desc: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: `2px solid ${selected ? '#3b82f6' : '#4b5563'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {selected && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e5e5e5' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )
}
