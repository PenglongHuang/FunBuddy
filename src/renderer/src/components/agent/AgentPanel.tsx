import { useEffect, useRef, useState } from 'react'
import { useAgentStore } from '@/stores/agentStore'
import { aiEvents, ai, dialog, fs } from '@/lib/ipc'
import { summarizeToolInput } from '@/lib/tool-input-summary'
import type { AgentMessage, AgentTask, AgentTaskStatus, ClaudeCheckResult } from '../../../../shared/agent-types'

const TOOL_ICON: Record<string, string> = {
  Read: '📖', Write: '📝', Edit: '✏️', Bash: '▶', Glob: '🔍', Grep: '🔎',
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
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
            <span
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 11, cursor: 'pointer',
                background: isEdit ? 'rgba(255,159,10,0.1)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isEdit ? 'rgba(255,159,10,0.3)' : 'rgba(255,255,255,0.1)'}`,
                color: isEdit ? '#FF9F0A' : 'rgba(255,255,255,0.7)',
                maxWidth: '100%',
              }}
            >
              {TOOL_ICON[t.name] ?? '🔧'} {t.name}{summary ? ` · ${summary}` : ''}
            </span>
            {expanded === i && t.input != null && (
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
  tasks, activeTaskId, onSelect, onDelete, onNew,
}: {
  tasks: AgentTask[]
  activeTaskId: string | null
  onSelect: (taskId: string) => void
  onDelete: (taskId: string) => void
  onNew: () => void
}) {
  const sorted = [...tasks].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  return (
    <div style={{ width: 172, flexShrink: 0, borderRight: '0.5px solid rgba(255,255,255,0.08)', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(0,0,0,0.18)', overflowY: 'auto' }}>
      <button onClick={onNew} style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.7)', border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 9, background: 'transparent', cursor: 'pointer' }}>
        ＋ 新会话
      </button>
      {sorted.map((t) => {
        const isActive = t.taskId === activeTaskId
        const meta = STATUS_META[t.status]
        const turns = t.messages.filter((m) => m.role === 'user').length
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

  const [workspace, setWorkspace] = useState('')
  const [claudeStatus, setClaudeStatus] = useState<ClaudeCheckResult | null>(null)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // 初始化默认工作空间 + 探活 Claude
  useEffect(() => {
    if (!defaultWorkspace) {
      ai.checkClaude().then((r) => setClaudeStatus(r))
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

  // 订阅流式消息
  useEffect(() => {
    return aiEvents.onMessage((taskId, msg) => {
      ingest(taskId, msg as AgentMessage)
    })
  }, [ingest])

  // 滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [tasks, activeTaskId])

  const activeTask = tasks.find((t) => t.taskId === activeTaskId) ?? null
  const isRunning = activeTask?.status === 'running'
  const lastMsg = activeTask?.messages[activeTask.messages.length - 1]
  // 运行中且当前没有正在流式的 assistant 气泡 → 显示"思考中"
  const showThinking = isRunning && !(lastMsg && lastMsg.role === 'assistant' && (lastMsg as { partial?: boolean }).partial)

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

  // 未装 Claude 引导
  if (claudeStatus && !claudeStatus.installed) {
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
          onClick={() => ai.checkClaude().then(setClaudeStatus)}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <button onClick={pickWorkspace} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 12px', color: 'inherit', cursor: 'pointer', fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📁 {workspace || '...'} ▾
        </button>
        <span style={{ fontSize: 11, color: '#FF9F0A', background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: 6, padding: '3px 8px' }}>
          ⚠ 无限制模式 · bypass
        </span>
      </div>

      {/* 主体:侧栏 + 对话 */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <SessionList
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSelect={setActiveTask}
          onDelete={deleteTask}
          onNew={handleNewConversation}
        />

        {/* 对话区 */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!activeTask && (
            <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40, fontSize: 12 }}>
              点左侧"新会话"或直接输入消息开始
            </div>
          )}
          {activeTask?.messages.map((m, i) => {
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
                  {(m.text || streaming) && (
                    <div style={{ fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {m.text}{streaming && <span className="fb-cursor">▋</span>}
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
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
