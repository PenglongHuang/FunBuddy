import { useEffect, useRef, useState } from 'react'

interface HotkeyRecorderProps {
  value: string
  onChange: (v: string) => void
  error: string | null
}

const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
  'ShiftLeft', 'ShiftRight',
  'MetaLeft', 'MetaRight',
])

const CODE_MAP: Record<string, string> = {
  Space: 'Space', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\',
  Comma: ',', Period: '.', Slash: '/',
  Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace',
  Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
}

function toAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')

  if (MODIFIER_CODES.has(e.code)) return null

  let key: string
  if (e.code.startsWith('Key')) {
    key = e.code.slice(3)
  } else if (e.code.startsWith('Digit')) {
    key = e.code.slice(5)
  } else if (e.code.startsWith('Numpad')) {
    key = e.code.slice(6)
  } else {
    key = CODE_MAP[e.code] || e.key.toUpperCase()
  }

  if (parts.length === 0) return null
  return [...parts, key].join('+')
}

export function HotkeyRecorder({ value, onChange, error }: HotkeyRecorderProps) {
  const [recording, setRecording] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!recording) return

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setRecording(false)
        return
      }

      const accel = toAccelerator(e)
      if (accel) {
        onChange(accel)
        setRecording(false)
      }
    }

    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setRecording(false)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onMouseDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [recording, onChange])

  return (
    <div>
      <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--separator)' }}>
        <span className="text-caption-1" style={{ color: 'var(--text-primary)' }}>快捷笔记快捷键</span>
        <div
          ref={ref}
          onClick={() => setRecording(true)}
          className="font-mono text-caption-1 px-3 py-1.5 inline-block cursor-pointer select-none"
          style={{
            color: recording ? 'var(--accent-blue)' : 'var(--text-secondary)',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: recording ? '2px solid var(--accent-blue)' : '2px solid transparent',
            outline: 'none',
            transition: 'border-color 0.15s, color 0.15s',
            minWidth: 100,
            textAlign: 'center',
          }}
        >
          {recording ? '请按下快捷键...' : value}
        </div>
      </div>
      {error && (
        <div className="text-caption-1" style={{ color: 'var(--accent-pink)', padding: '4px 0' }}>
          {error}
        </div>
      )}
    </div>
  )
}
