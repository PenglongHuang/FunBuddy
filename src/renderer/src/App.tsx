import { useEffect, useState, Component, type ReactNode } from 'react'
import { X } from 'lucide-react'
import Sidebar from '@/components/sidebar/Sidebar'
import PetModeView from '@/components/pet/PetModeView'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePetAnimation } from '@/hooks/usePetAnimation'
import { usePanelMorph } from '@/hooks/usePanelMorph'
import { useTimer } from '@/hooks/useTimer'
import { usePetStore } from '@/stores/petStore'
import { fs, windowApi } from '@/lib/ipc'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#ff6b6b', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {this.state.error.toString()}
          {'\n\n'}
          {this.state.error.stack}
        </div>
      )
    }
    return this.props.children
  }
}
function QuickCapture() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    const cleanup = window.api.onQuickCapture(() => {
      setTitle('')
      setContent('')
    })
    return cleanup
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.close()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const submit = async () => {
    if (!title.trim()) return
    const { useNoteStore } = await import('@/stores/noteStore')
    const note = await useNoteStore.getState().createNote(title, content, ['快捷笔记'])
    setTitle('')
    setContent('')
    window.api.quickNoteSaved(note.id)
    window.close()
  }

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        position: 'relative',
        background: 'rgba(28, 28, 30, 0.95)',
        backdropFilter: 'blur(60px) saturate(180%)',
        WebkitBackdropFilter: 'blur(60px) saturate(180%)',
        borderRadius: 'var(--radius-xl)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        padding: '12px 14px',
        gap: 8,
      }}
    >
      <button
        onClick={() => window.close()}
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
          zIndex: 1,
        }}
        aria-label="关闭"
      >
        <X size={14} strokeWidth={1.8} />
      </button>
      <input
        autoFocus
        className="w-full text-primary outline-none bg-transparent"
        style={{
          font: 'var(--text-callout)',
          fontWeight: 500,
          border: 'none',
          borderBottom: '0.5px solid var(--separator)',
          paddingBottom: 8,
        }}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="标题"
      />
      <textarea
        className="w-full flex-1 text-primary outline-none bg-transparent resize-none"
        style={{
          font: 'var(--text-footnote)',
          color: 'var(--text-secondary)',
          border: 'none',
          minHeight: 48,
        }}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="内容..."
      />
      <div className="flex items-center justify-between shrink-0">
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(10,132,255,0.15)',
            color: '#0A84FF',
          }}
        >
          快捷笔记
        </span>
        <button
          onClick={submit}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#0A84FF',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          保存 ↵
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load)
  const storageDir = useSettingsStore((s) => s.storageDir)
  const windowMode = usePetStore((s) => s.windowMode)
  const setWindowMode = usePetStore((s) => s.setWindowMode)

  usePetAnimation()
  usePanelMorph()
  useTimer()

  const isQuickCapture = window.location.hash === '#quick-capture'

  useEffect(() => { loadSettings() }, [loadSettings])

  useEffect(() => {
    fs.mkdir('plans').catch(() => {})
    fs.mkdir('notes').catch(() => {})
  }, [storageDir])

  // ESC handler — collapse to pet mode when in expanded mode
  useEffect(() => {
    if (!isQuickCapture && windowMode === 'expanded') {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setWindowMode('pet')
        }
      }
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }
  }, [isQuickCapture, windowMode, setWindowMode])

  // Navigate to note when quick capture saves
  useEffect(() => {
    if (isQuickCapture) return
    const cleanup = window.api.onNavigateToNote(async (noteId) => {
      const { useNoteStore } = await import('@/stores/noteStore')
      await useNoteStore.getState().load()
      const { useNavigationStore } = await import('@/stores/navigationStore')
      useNavigationStore.getState().push({ panel: 'notes', subView: 'editor', noteId })
      if (usePetStore.getState().windowMode !== 'expanded') {
        windowApi.expandPanel()
      }
    })
    return cleanup
  }, [isQuickCapture])

  // Window mode change from tray (main → renderer)
  useEffect(() => {
    if (isQuickCapture) return
    const cleanup = window.api.onSetWindowMode((mode) => {
      setWindowMode(mode as 'pet' | 'expanded')
    })
    return cleanup
  }, [isQuickCapture, setWindowMode])

  if (isQuickCapture) return <QuickCapture />

  // Mode routing
  if (windowMode === 'pet') {
    return <PetModeView />
  }

  return (
    <div className="w-full h-full">
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>
    </div>
  )
}
