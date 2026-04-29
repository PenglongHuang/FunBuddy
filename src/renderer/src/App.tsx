import { useEffect, useState } from 'react'
import Sidebar from '@/components/sidebar/Sidebar'
import PetModeView from '@/components/pet/PetModeView'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePetAnimation } from '@/hooks/usePetAnimation'
import { usePanelMorph } from '@/hooks/usePanelMorph'
import { useTimer } from '@/hooks/useTimer'
import { usePetStore } from '@/stores/petStore'
import { fs } from '@/lib/ipc'
import { nanoid } from 'nanoid'

function QuickCapture() {
  const [input, setInput] = useState('')

  useEffect(() => {
    const cleanup = window.api.onQuickCapture(() => setInput(''))
    return cleanup
  }, [])

  const submit = async () => {
    if (!input.trim()) return
    const id = nanoid(8)
    const title = input.split('\n')[0].slice(0, 30) || new Date().toLocaleString('zh-CN')
    const filePath = `notes/${id}-quick-capture.md`
    const now = new Date().toISOString()
    await fs.writeFile(filePath, `# ${title}\n\n${input}`)
    const COLOR_PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']
    let notes: any[] = []
    try { notes = JSON.parse(await fs.readFile('notes/index.json')) } catch {}
    notes.push({ id, title, filePath, color: COLOR_PALETTE[notes.length % 5], tags: [], createdAt: now, updatedAt: now })
    await fs.writeFile('notes/index.json', JSON.stringify(notes, null, 2))
    setInput('')
    window.close()
  }

  return (
    <div
      className="w-full h-full flex flex-col gap-2 items-center justify-center"
      style={{
        background: 'var(--bg-base)',
        backdropFilter: 'blur(60px) saturate(180%)',
        WebkitBackdropFilter: 'blur(60px) saturate(180%)',
        borderRadius: 'var(--radius-xl)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        padding: 20,
      }}
    >
      <input
        autoFocus
        className="w-full text-body text-primary outline-none placeholder:text-quaternary bg-transparent"
        style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          border: '1px solid transparent',
          fontSize: 15,
        }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="快速捕获..."
      />
      <button
        onClick={submit}
        className="text-caption-1 font-medium px-4 py-2 rounded-lg"
        style={{ color: 'var(--accent-blue)' }}
      >
        保存
      </button>
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

  if (isQuickCapture) return <QuickCapture />

  // Mode routing
  if (windowMode === 'pet') {
    return <PetModeView />
  }

  return (
    <div className="w-full h-full">
      <Sidebar />
    </div>
  )
}
