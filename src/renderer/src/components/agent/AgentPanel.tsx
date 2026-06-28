import { useEffect, useRef, useState } from 'react'
import { useAgentStore } from '@/stores/agentStore'
import { aiEvents, ai, dialog, fs } from '@/lib/ipc'
import type { AgentMessage, ClaudeCheckResult } from '../../../../shared/agent-types'

const TOOL_ICON: Record<string, string> = {
  Read: '📖', Write: '📝', Edit: '✏️', Bash: '▶', Glob: '🔍', Grep: '🔎',
  WebSearch: '🌐', WebFetch: '🔗',
}

function ToolPills({ toolUses }: { toolUses: { name: string; input?: unknown }[] }) {
  if (toolUses.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
      {toolUses.map((t, i) => (
        <span
          key={i}
          style={{
            fontSize: 11, padding: '3px 9px', borderRadius: 11,
            background: t.name === 'Edit' || t.name === 'Write' ? 'rgba(255,159,10,0.1)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${t.name === 'Edit' || t.name === 'Write' ? 'rgba(255,159,10,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: t.name === 'Edit' || t.name === 'Write' ? '#FF9F0A' : 'rgba(255,255,255,0.7)',
          }}
        >
          {TOOL_ICON[t.name] ?? '🔧'} {t.name}
        </span>
      ))}
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

  const [workspace, setWorkspace] = useState('')
  const [claudeStatus, setClaudeStatus] = useState<ClaudeCheckResult | null>(null)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // 初始化默认工作空间(defaultWorkspace 变化时跑;workspace 不入 deps —— effect 内会 setWorkspace,
  // 放进 deps 会触发重跑。功能仍自稳定:首次 defaultWorkspace='' 拉取并设置,二次 defaultWorkspace 已就绪)
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

  async function pickWorkspace() {
    const dir = await dialog.openDirectory()
    if (dir) setWorkspace(dir)
  }

  function handleSend() {
    const text = input.trim()
    if (!text) return
    if (!workspace) return // 工作空间未就绪时不发送(避免空 cwd)
    let taskId = activeTaskId
    if (!taskId || activeTask?.status === 'idle' || activeTask?.status === 'error' || activeTask?.status === 'stopped') {
      taskId = createTask(text.slice(0, 40), workspace)
    }
    sendPrompt(taskId, text)
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
      {/* 顶栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <button onClick={pickWorkspace} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 12px', color: 'inherit', cursor: 'pointer', fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📁 {workspace || '...'} ▾
        </button>
        <span style={{ fontSize: 11, color: '#FF9F0A', background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: 6, padding: '3px 8px' }}>
          ⚠ 无限制模式 · bypass
        </span>
      </div>

      {/* 对话区 */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!activeTask && (
          <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40, fontSize: 12 }}>
            输入消息开始一个 agent 任务
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
            return (
              <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {m.text && <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{m.text}</div>}
                <ToolPills toolUses={m.toolUses} />
              </div>
            )
          }
          // system
          if (m.kind === 'error') {
            return <div key={i} style={{ alignSelf: 'center', fontSize: 11, color: '#FF453a' }}>⚠ 出错了{(m.meta as any)?.error ? `:${(m.meta as any).error}` : ''}</div>
          }
          return null
        })}
      </div>

      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="输入消息,回车发送..."
          style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(10,132,255,0.3)', borderRadius: 11, padding: '9px 13px', color: 'rgba(255,255,255,0.9)', fontSize: 13, outline: 'none' }}
        />
        {activeTask?.status === 'running' && (
          <button onClick={() => activeTaskId && stopTask(activeTaskId)} style={{ background: 'rgba(255,69,58,0.18)', border: '1px solid rgba(255,69,58,0.4)', color: '#FF453a', borderRadius: 10, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
            ■ 停止
          </button>
        )}
      </div>
    </div>
  )
}
