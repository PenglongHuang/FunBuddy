import { useEffect, useRef, useState } from 'react'
import { PanelLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import MarkdownPreview from '@/components/common/MarkdownPreview'
import { useAgentStore } from '@/stores/agentStore'
import { useToastStore } from '@/stores/toastStore'
import { aiEvents, ai, dialog, fs } from '@/lib/ipc'
import { summarizeToolInput } from '@/lib/tool-input-summary'
import type { AgentMessage, AgentTask, AgentTaskStatus, ProviderInfo } from '../../../../shared/agent-types'

const TOOL_ICON: Record<string, string> = {
  Read: '📖', Write: '📝', Edit: '✏️', Bash: '💻', Glob: '🔍', Grep: '🔎',
  WebSearch: '🌐', WebFetch: '🔗', Task: '🤖', Agent: '🤖',
}

const STATUS_META: Record<AgentTaskStatus, { dot: string; label: string; color: string }> = {
  running: { dot: '●', label: '运行中', color: '#30D158' },
  idle: { dot: '○', label: '空闲', color: 'rgba(255,255,255,0.4)' },
  error: { dot: '●', label: '出错', color: '#FF453a' },
  stopped: { dot: '○', label: '已停止', color: 'rgba(255,255,255,0.4)' },
}

function ToolPills({ toolUses }: { toolUses: { name: string; input?: unknown }[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  if (toolUses.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
      {toolUses.map((t, i) => {
        const summary = summarizeToolInput(t.name, t.input)
        const isEdit = t.name === 'Edit' || t.name === 'Write'
        const isOpen = expanded === i
        const hasInput = t.input != null
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
            <span
              onClick={hasInput ? () => setExpanded(isOpen ? null : i) : undefined}
              style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 11,
                cursor: hasInput ? 'pointer' : 'default',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: isEdit ? 'rgba(255,159,10,0.1)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isEdit ? 'rgba(255,159,10,0.3)' : 'rgba(255,255,255,0.1)'}`,
                color: isEdit ? '#FF9F0A' : 'rgba(255,255,255,0.7)',
                maxWidth: '100%',
              }}
            >
              <span>{TOOL_ICON[t.name] ?? '🔧'} {t.name}{summary ? ` · ${summary}` : ''}</span>
              {hasInput && (
                <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.55, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease' }} />
              )}
            </span>
            {isOpen && t.input != null && (
              <pre style={{
                margin: 0, maxWidth: '100%', overflowX: 'auto', fontSize: 10.5, lineHeight: 1.4,
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '6px 8px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-wrap',
              }}>
                {JSON.stringify(t.input, null, 2)}
              </pre>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SessionList({
  tasks, activeTaskId, onSelect, onDelete, onNew, collapsed,
}: {
  tasks: AgentTask[]
  activeTaskId: string | null
  onSelect: (taskId: string) => void
  onDelete: (taskId: string) => void
  onNew: () => void
  collapsed: boolean
}) {
  const sorted = [...tasks].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  return (
    <div style={{ width: collapsed ? 0 : 172, flexShrink: 0, borderRight: collapsed ? 'none' : '0.5px solid rgba(255,255,255,0.08)', padding: collapsed ? 0 : '8px 6px', display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(0,0,0,0.18)', overflowX: 'hidden', overflowY: collapsed ? 'hidden' : 'auto', transition: 'width .18s ease, padding .18s ease' }}>
      {!collapsed && (
        <>
          <button onClick={onNew} style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.7)', border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 9, background: 'transparent', cursor: 'pointer' }}>
            ＋ 新会话
          </button>
          {sorted.map((t) => {
        const isActive = t.taskId === activeTaskId
        const meta = STATUS_META[t.status]
        const turns = useAgentStore.getState().getMessages(t.taskId).filter((m) => m.role === 'user').length
        return (
          <div
            key={t.taskId}
            onClick={() => onSelect(t.taskId)}
            style={{
              position: 'relative', padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
              border: `1px solid ${isActive ? 'rgba(0,122,255,0.3)' : 'transparent'}`,
              background: isActive ? 'linear-gradient(135deg, rgba(0,122,255,0.18), rgba(175,82,222,0.18))' : 'transparent',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 14 }}>
              {t.title || '(新会话)'}
            </div>
            <div style={{ fontSize: 10, color: isActive ? meta.color : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{meta.dot}</span>{meta.label} · {turns} 轮
            </div>
            <span
              onClick={(e) => { e.stopPropagation(); onDelete(t.taskId) }}
              style={{ position: 'absolute', top: 5, right: 6, fontSize: 13, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', lineHeight: 1 }}
              title="删除会话"
            >
              ×
            </span>
          </div>
        )
      })}
        </>
      )}
    </div>
  )
}

export default function AgentPanel() {
  const tasks = useAgentStore((s) => s.tasks)
  const activeTaskId = useAgentStore((s) => s.activeTaskId)
  const defaultWorkspace = useAgentStore((s) => s.defaultWorkspace)
  const setDefaultWorkspace = useAgentStore((s) => s.setDefaultWorkspace)
  const createTask = useAgentStore((s) => s.createTask)
  const sendPrompt = useAgentStore((s) => s.sendPrompt)
  const stopTask = useAgentStore((s) => s.stopTask)
  const ingest = useAgentStore((s) => s.ingest)
  const setActiveTask = useAgentStore((s) => s.setActiveTask)
  const deleteTask = useAgentStore((s) => s.deleteTask)
  const hydrate = useAgentStore((s) => s.hydrate)
  const loadHistory = useAgentStore((s) => s.loadHistory)
  const hydrated = useAgentStore((s) => s.hydrated)
  const migratedDropped = useAgentStore((s) => s.migratedDropped)
  // useShallow:activeTaskId 为 null 或会话尚未加载时,`?? []`/`: []` 每次返回新空数组,
  // zustand v5 底层 useSyncExternalStore 会判定 store 变化 → 无限渲染(Maximum update depth exceeded)。
  // 浅比较让两个空数组判等,稳定引用,终止循环。
  const activeMessages = useAgentStore(
    useShallow((s) => (activeTaskId ? (s._messages[activeTaskId] ?? []) : [])),
  )

  const [workspace, setWorkspace] = useState('')
  const [claudeStatus, setClaudeStatus] = useState<ProviderInfo | null>(null)
  const [input, setInput] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  // 初始化默认工作空间 + 探活 Claude
  useEffect(() => {
    if (!defaultWorkspace) {
      ai.getProviderInfo().then((r) => setClaudeStatus(r))
      fs.getStorageDir().then((d) => {
        setDefaultWorkspace(d)
        setWorkspace(d)
      })
    } else if (!workspace) {
      setWorkspace(defaultWorkspace)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultWorkspace, setDefaultWorkspace])

  // 启动时加载持久化的会话
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // 迁移清理提示
  useEffect(() => {
    if (hydrated && migratedDropped > 0) {
      useToastStore.getState().show('已清理旧版会话记录文件')
    }
  }, [hydrated, migratedDropped])

  // 订阅流式消息
  useEffect(() => {
    return aiEvents.onMessage((taskId, msg) => {
      ingest(taskId, msg as AgentMessage)
    })
  }, [ingest])

  // 切换会话：强制滚到底并恢复跟随
  useEffect(() => {
    stickToBottomRef.current = true
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    if (activeTaskId) {
      loadHistory(activeTaskId)
    }
  }, [activeTaskId, loadHistory])

  // 新消息/流式增量：仅在用户未上滑时跟随
  useEffect(() => {
    if (stickToBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }
  }, [activeMessages])

  const activeTask = tasks.find((t) => t.taskId === activeTaskId) ?? null
  const isRunning = activeTask?.status === 'running'
  const lastMsg = activeMessages[activeMessages.length - 1]
  // "正在流式输出可见文本"：最后一条是带文本的 partial —— 此时显示光标，而非"思考中"
  const lastIsStreamingText =
    !!lastMsg && lastMsg.role === 'assistant' && !!lastMsg.partial && !!lastMsg.text
  // 思考中：运行中、但还没开始输出可见文本（含 message_start 空 partial、纯工具调用阶段、轮次之间）
  const showThinking = isRunning && !lastIsStreamingText

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    // 贴近底部（容差 80px）才视为"跟随"
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function pickWorkspace() {
    const dir = await dialog.openDirectory()
    if (dir) setWorkspace(dir)
  }

  function handleSend() {
    const text = input.trim()
    if (!text || !workspace) return
    if (isRunning) return // 流式中不重复发送
    let taskId = activeTaskId
    if (!taskId) {
      taskId = createTask('新会话', workspace)
    }
    sendPrompt(taskId, text)
    setInput('')
  }

  function handleNewConversation() {
    createTask('新会话', workspace || defaultWorkspace)
    setInput('')
  }

  async function handleDelete(taskId: string) {
    const res = await dialog.showMessageBox({
      type: 'warning',
      message: '删除此会话？',
      detail: '该 AI 会话的历史记录将被清除，且无法恢复。',
      buttons: ['取消', '删除'],
      defaultId: 0,
      cancelId: 0,
    })
    if (res.response === 1) deleteTask(taskId)
  }

  // 未装 Claude 引导
  if (claudeStatus && !claudeStatus.available) {
    return (
      <div style={{ padding: 24, color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.7 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>✨</div>
        <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>未检测到 Claude Code</p>
        <p>请先在终端安装并登录:</p>
        <pre style={{ background: 'rgba(255,255,255,0.06)', padding: 10, borderRadius: 8, fontSize: 12 }}>
{`npm install -g @anthropic-ai/claude-code
claude   # 登录`}
        </pre>
        <button
          onClick={() => ai.getProviderInfo().then(setClaudeStatus)}
          style={{ marginTop: 12, padding: '6px 14px', borderRadius: 8, background: 'rgba(10,132,255,0.2)', border: '1px solid rgba(10,132,255,0.4)', color: 'white', cursor: 'pointer' }}
        >
          重新检测
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
      <style>{`
        @keyframes fb-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fb-dot { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
        .fb-cursor{ animation: fb-blink 1s step-end infinite; color:#30D158 }
        .fb-dot{ animation: fb-dot 1.4s infinite both; display:inline-block }
      `}</style>

      {/* 顶栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button onClick={pickWorkspace} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 12px', color: 'inherit', cursor: 'pointer', fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📁 {workspace || '...'} ▾
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#FF9F0A', background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: 6, padding: '3px 8px' }}>
            ⚠ bypass 模式
          </span>
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? '展开会话列表' : '收起会话列表'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 28, borderRadius: 8, cursor: 'pointer',
              background: sidebarCollapsed ? 'transparent' : 'rgba(255,255,255,0.14)',
              border: `1px solid ${sidebarCollapsed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'}`,
              color: sidebarCollapsed ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.95)',
              transition: 'background .15s ease, color .15s ease',
            }}
          >
            <PanelLeft size={14} strokeWidth={1.7} />
          </button>
        </div>
      </div>

      {/* 主体:侧栏 + 对话 */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <SessionList
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSelect={setActiveTask}
          onDelete={handleDelete}
          onNew={handleNewConversation}
          collapsed={sidebarCollapsed}
        />

        {/* 对话区 */}
        <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10, userSelect: 'text' }}>
          {!activeTask && (
            <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40, fontSize: 12 }}>
              点左侧"新会话"或直接输入消息开始
            </div>
          )}
          {activeMessages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '75%', background: 'rgba(10,132,255,0.18)', border: '1px solid rgba(10,132,255,0.3)', padding: '8px 12px', borderRadius: '12px 12px 4px 12px', fontSize: 12.5, lineHeight: 1.5 }}>
                  {m.text}
                </div>
              )
            }
            if (m.role === 'assistant') {
              const streaming = (m as { partial?: boolean }).partial
              return (
                <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {m.text && (
                    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                      <MarkdownPreview content={m.text} linkTarget="_blank" />
                      {streaming && <span className="fb-cursor">▋</span>}
                    </div>
                  )}
                  <ToolPills toolUses={m.toolUses} />
                </div>
              )
            }
            // system
            if (m.kind === 'error') {
              return <div key={i} style={{ alignSelf: 'center', fontSize: 11, color: '#FF453a' }}>⚠ 出错了{(m.meta as { error?: string })?.error ? `:${(m.meta as { error?: string }).error}` : ''}</div>
            }
            return null
          })}
          {showThinking && (
            <div style={{ alignSelf: 'flex-start', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              思考中
              <span className="fb-dot" style={{ animationDelay: '0ms' }}>.</span>
              <span className="fb-dot" style={{ animationDelay: '200ms' }}>.</span>
              <span className="fb-dot" style={{ animationDelay: '400ms' }}>.</span>
            </div>
          )}
        </div>
      </div>

      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
        <input
          value={input}
          disabled={isRunning}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={isRunning ? '生成中...' : '输入消息,回车发送...(同一会话内追问会带上历史)'}
          style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(10,132,255,0.3)', borderRadius: 11, padding: '9px 13px', color: 'rgba(255,255,255,0.9)', fontSize: 13, outline: 'none', opacity: isRunning ? 0.6 : 1 }}
        />
        {isRunning ? (
          <button onClick={() => activeTaskId && stopTask(activeTaskId)} style={{ background: 'rgba(255,69,58,0.18)', border: '1px solid rgba(255,69,58,0.4)', color: '#FF453a', borderRadius: 10, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
            ■ 停止
          </button>
        ) : (
          <button onClick={handleSend} disabled={!input.trim()} style={{ background: 'rgba(10,132,255,0.2)', border: '1px solid rgba(10,132,255,0.4)', color: 'white', borderRadius: 10, padding: '8px 16px', fontSize: 12, cursor: 'pointer', opacity: input.trim() ? 1 : 0.5 }}>
            发送
          </button>
        )}
      </div>
    </div>
  )
}
