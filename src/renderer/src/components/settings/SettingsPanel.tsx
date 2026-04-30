import { useSettingsStore } from '@/stores/settingsStore'
import { usePlanStore } from '@/stores/planStore'
import { useNoteStore } from '@/stores/noteStore'
import { dialog, fs, store } from '@/lib/ipc'
import { FolderOpen, Timer, Zap, Database, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useToast } from '@/components/common/Toast'

/* ============================================
   iOS/macOS-style Toggle Switch
   ============================================ */
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--separator)' }}>
      <span className="text-caption-1" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="relative"
        style={{
          width: 42,
          height: 24,
          borderRadius: 'var(--radius-full)',
          background: value ? 'var(--accent-blue)' : 'rgba(120,120,128,0.24)',
          transition: 'background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.12)',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: value ? 'translateX(18px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  )
}

/* ============================================
   Settings Group Card Container
   ============================================ */
function SettingsGroup({
  icon,
  title,
  iconColor,
  children,
}: {
  icon: React.ReactNode
  title: string
  iconColor: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: 20,
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: 16,
      }}
    >
      {/* Group header */}
      <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
        <div style={{ color: iconColor }}>{icon}</div>
        <span className="text-caption-1 font-semibold tracking-wide" style={{ color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
          {title}
        </span>
      </div>

      {/* Group content */}
      {children}
    </div>
  )
}

/* ============================================
   Number Input Row
   ============================================ */
function NumberInputRow({
  label,
  value,
  unit,
  onChange,
  min = 1,
  max = 120,
  step = 1,
}: {
  label: string
  value: number
  unit: string
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  const stepperStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1,
    padding: 0,
  }

  return (
    <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--separator)' }}>
      <span className="text-caption-1" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          className="stepper-btn"
          disabled={value <= min}
          style={{
            ...stepperStyle,
            color: value <= min ? 'var(--text-tertiary)' : 'var(--accent-blue)',
            cursor: value <= min ? 'default' : 'pointer',
          }}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          −
        </button>
        <div
          style={{
            width: 32,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {value}
        </div>
        <button
          className="stepper-btn"
          disabled={value >= max}
          style={{
            ...stepperStyle,
            color: value >= max ? 'var(--text-tertiary)' : 'var(--accent-blue)',
            cursor: value >= max ? 'default' : 'pointer',
          }}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          +
        </button>
        <span className="text-caption-1 ml-1" style={{ color: 'var(--text-tertiary)' }}>{unit}</span>
      </div>
    </div>
  )
}

/* ============================================
   Action Button Styles
   ============================================ */
const btnPrimary: React.CSSProperties = {
  background: 'var(--accent-blue)',
  color: 'white',
  padding: '0 16px',
  height: 36,
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.15s ease',
}

const btnDestructive: React.CSSProperties = {
  background: 'rgba(255,55,95,0.10)',
  color: 'var(--accent-pink)',
  padding: '0 14px',
  height: 36,
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
}

const btnGhost: React.CSSProperties = {
  color: 'var(--accent-blue)',
  background: 'transparent',
  padding: '0 12px',
  height: 36,
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
}

/* ============================================
   Main Settings Panel
   ============================================ */
export default function SettingsPanel() {
  const storageDir = useSettingsStore((s) => s.storageDir)
  const storageDirHistory = useSettingsStore((s) => s.storageDirHistory)
  const pomodoro = useSettingsStore((s) => s.pomodoro)
  const app = useSettingsStore((s) => s.app)
  const setStorageDir = useSettingsStore((s) => s.setStorageDir)
  const updatePomodoro = useSettingsStore((s) => s.updatePomodoro)
  const updateApp = useSettingsStore((s) => s.updateApp)
  const { showToast, ToastContainer } = useToast()
  const [effectiveDir, setEffectiveDir] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  const [pendingPomodoro, setPendingPomodoro] = useState(pomodoro)
  const [pendingApp, setPendingApp] = useState(app)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    fs.getStorageDir().then(setEffectiveDir)
  }, [storageDir])

  useEffect(() => {
    if (!historyOpen) return
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [historyOpen])

  useEffect(() => {
    if (!isDirty) {
      setPendingPomodoro(pomodoro)
      setPendingApp(app)
    }
  }, [pomodoro, app, isDirty])

  const checkDirty = (newPom: typeof pomodoro, newApp: typeof app) => {
    const pomChanged = (Object.keys(newPom) as (keyof typeof newPom)[]).some(
      (k) => newPom[k] !== pomodoro[k]
    )
    const appChanged = (Object.keys(newApp) as (keyof typeof newApp)[]).some(
      (k) => newApp[k] !== app[k]
    )
    setIsDirty(pomChanged || appChanged)
  }

  const handleSave = async () => {
    await Promise.all([
      updatePomodoro(pendingPomodoro),
      updateApp(pendingApp),
    ])
    setIsDirty(false)
    showToast('已保存', 1500)
  }

  const handleReset = () => {
    setPendingPomodoro(pomodoro)
    setPendingApp(app)
    setIsDirty(false)
  }

  const handlePickDir = async () => {
    const dir = await dialog.openDirectory()
    if (dir) {
      await setStorageDir(dir)
      usePlanStore.getState().load()
      useNoteStore.getState().load()
      showToast('已保存', 1500)
    }
  }

  const plans = usePlanStore((s) => s.plans)
  const notes = useNoteStore((s) => s.notes)

  const handleExportJSON = async () => {
    try {
      const filePath = await dialog.showSaveDialog({
        title: '导出 JSON',
        defaultPath: 'funpets-export.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!filePath) return

      const exportData: Record<string, unknown> = {}
      const plansWithContent = []
      for (const plan of plans) {
        const content = await usePlanStore.getState().loadPlanContent(plan.id)
        plansWithContent.push({ ...plan, content })
      }
      exportData.plans = plansWithContent

      const notesWithContent = []
      for (const note of notes) {
        const content = await useNoteStore.getState().loadNoteContent(note.id)
        notesWithContent.push({ ...note, content })
      }
      exportData.notes = notesWithContent

      exportData.settings = { storageDir, pomodoro: pendingPomodoro, app: pendingApp }
      exportData.timer = await store.get('timer')
      exportData.timerHistory = await store.get('timerHistory')

      await fs.writeFileAbsolute(filePath, JSON.stringify(exportData, null, 2))
      showToast('已保存', 1500)
    } catch (err) {
      await dialog.showMessageBox({
        type: 'error',
        title: '导出失败',
        message: 'JSON 导出过程中发生错误',
        detail: String(err),
      })
    }
  }

  const handleClearData = async () => {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: '清空数据',
      message: '确定要清空所有数据吗？此操作不可撤销。',
      detail: '将删除所有计划、笔记，并重置设置。',
      buttons: ['取消', '清空数据'],
      defaultId: 0,
      cancelId: 0,
    })
    if (result.response !== 1) return

    for (const plan of plans) {
      try { await fs.deleteFile(plan.filePath) } catch { /* already deleted */ }
    }
    await fs.writeFile('plans/index.json', '[]')

    for (const note of notes) {
      try { await fs.deleteFile(note.filePath) } catch { /* already deleted */ }
    }
    await fs.writeFile('notes/index.json', '[]')

    usePlanStore.getState().load()
    useNoteStore.getState().load()
    showToast('已保存', 1500)
  }

  return (
    <div className="flex flex-col" style={{ position: 'relative' }}>
      <ToastContainer />

      {/* Unsaved changes bar + Save button */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: isDirty ? '8px 0' : 0,
          marginBottom: isDirty ? 8 : 0,
          opacity: isDirty ? 1 : 0,
          maxHeight: isDirty ? 60 : 0,
          overflow: 'hidden',
          transform: isDirty ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1), padding 0.25s cubic-bezier(0.16, 1, 0.3, 1), margin 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: isDirty ? 'auto' : 'none',
        }}
      >
        <span className="text-caption-1" style={{ color: 'var(--accent-yellow)' }}>
          未保存的更改
        </span>
        <div className="flex gap-2">
          <button onClick={handleReset} style={btnGhost}>重置</button>
          <button onClick={handleSave} style={btnPrimary}>保存</button>
        </div>
      </div>

      {/* ===== Storage Group ===== */}
      <SettingsGroup
        icon={<FolderOpen size={16} />}
        title="存储"
        iconColor="var(--accent-green)"
      >
        <div style={{ paddingBottom: 4 }}>
          <div ref={historyRef} style={{ position: 'relative' }}>
            <div
              className="flex items-center gap-2"
              onClick={() => storageDirHistory.length > 0 && setHistoryOpen(!historyOpen)}
              style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                marginBottom: 10,
                cursor: storageDirHistory.length > 0 ? 'pointer' : 'default',
              }}
            >
              <span
                className="text-caption-1 font-mono truncate block"
                style={{ color: 'var(--text-secondary)', flex: 1 }}
              >
                {effectiveDir}
              </span>
              {!storageDir && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--accent-green)',
                    background: 'rgba(48,209,88,0.12)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    flexShrink: 0,
                  }}
                >
                  默认
                </span>
              )}
              {storageDirHistory.length > 0 && (
                <ChevronDown
                  size={14}
                  style={{
                    color: 'var(--text-tertiary)',
                    flexShrink: 0,
                    transition: 'transform 0.2s ease',
                    transform: historyOpen ? 'rotate(180deg)' : 'rotate(0)',
                  }}
                />
              )}
            </div>

            {historyOpen && storageDirHistory.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '0.5px solid var(--separator)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                marginTop: -6,
                overflow: 'hidden',
              }}>
                {storageDirHistory.map((dir) => (
                  <div
                    key={dir}
                    onClick={async () => {
                      await setStorageDir(dir)
                      setHistoryOpen(false)
                      usePlanStore.getState().load()
                      useNoteStore.getState().load()
                      showToast('已保存', 1500)
                    }}
                    className="text-caption-1 font-mono truncate hover-tertiary-bg"
                    style={{
                      padding: '8px 12px',
                      color: dir === storageDir ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      background: dir === storageDir ? 'rgba(10,132,255,0.08)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {dir}
                  </div>
                ))}
                <div
                  onClick={() => { setHistoryOpen(false); handlePickDir() }}
                  className="hover-tertiary-bg"
                  style={{
                    padding: '8px 12px',
                    color: 'var(--accent-blue)',
                    cursor: 'pointer',
                    borderTop: '1px solid var(--separator)',
                    fontSize: 12,
                    transition: 'background 0.15s ease',
                  }}
                >
                  选择其他目录...
                </div>
              </div>
            )}
          </div>
          <button onClick={handlePickDir} style={btnPrimary}>
            选择目录
          </button>
        </div>
      </SettingsGroup>

      {/* ===== Pomodoro Group ===== */}
      <SettingsGroup
        icon={<Timer size={16} />}
        title="番茄钟"
        iconColor="var(--accent-yellow)"
      >
        <NumberInputRow
          label="专注时长"
          value={pendingPomodoro.focusDuration}
          unit="分钟"
          min={1} max={120}
          onChange={(v) => { const next = { ...pendingPomodoro, focusDuration: v }; setPendingPomodoro(next); checkDirty(next, pendingApp) }}
        />
        <NumberInputRow
          label="短休息"
          value={pendingPomodoro.shortBreak}
          unit="分钟"
          min={1} max={30}
          onChange={(v) => { const next = { ...pendingPomodoro, shortBreak: v }; setPendingPomodoro(next); checkDirty(next, pendingApp) }}
        />
        <NumberInputRow
          label="长休息"
          value={pendingPomodoro.longBreak}
          unit="分钟"
          min={5} max={60}
          onChange={(v) => { const next = { ...pendingPomodoro, longBreak: v }; setPendingPomodoro(next); checkDirty(next, pendingApp) }}
        />
        <NumberInputRow
          label="轮次"
          value={pendingPomodoro.roundsBeforeLongBreak}
          unit="轮后长休息"
          min={2} max={10}
          onChange={(v) => { const next = { ...pendingPomodoro, roundsBeforeLongBreak: v }; setPendingPomodoro(next); checkDirty(next, pendingApp) }}
        />
      </SettingsGroup>

      {/* ===== App Behavior Group ===== */}
      <SettingsGroup
        icon={<Zap size={16} />}
        title="应用行为"
        iconColor="var(--accent-blue)"
      >
        <ToggleRow
          label="开机自启动"
          value={pendingApp.autoStart}
          onChange={(v) => { const next = { ...pendingApp, autoStart: v }; setPendingApp(next); checkDirty(pendingPomodoro, next) }}
        />
        <ToggleRow
          label="关闭时最小化到托盘"
          value={pendingApp.closeToTray}
          onChange={(v) => { const next = { ...pendingApp, closeToTray: v }; setPendingApp(next); checkDirty(pendingPomodoro, next) }}
        />
        <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--separator)' }}>
          <span className="text-caption-1" style={{ color: 'var(--text-primary)' }}>快速捕获快捷键</span>
          <span
            className="font-mono text-caption-1 px-2 py-1 inline-block"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {app.quickCaptureHotkey}
          </span>
        </div>
      </SettingsGroup>

      {/* ===== Data Management Group ===== */}
      <SettingsGroup
        icon={<Database size={16} />}
        title="数据管理"
        iconColor="var(--accent-purple)"
      >
        <div className="flex gap-2" style={{ paddingTop: 4 }}>
          <button onClick={handleExportJSON} style={btnGhost}>导出 JSON</button>
          <button onClick={handleClearData} style={btnDestructive}>清空数据</button>
        </div>
      </SettingsGroup>
    </div>
  )
}
