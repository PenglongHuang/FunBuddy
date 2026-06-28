import { spawn } from 'child_process'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { getMainWindow } from './window'
import { IPC } from '../shared/ipc-channels'
import { mapToAgentMessage } from './claude-message-mapper'
import type { AgentMessage, ClaudeCheckResult } from '../shared/agent-types'

interface SessionState {
  taskId: string
  sessionId?: string
  controller: AbortController
  workspace: string
}

const sessions = new Map<string, SessionState>()

function send(taskId: string, msg: AgentMessage): void {
  const win = getMainWindow()
  try {
    win?.webContents.send(IPC.AI_MESSAGE, { taskId, msg })
  } catch {
    /* window may be closed */
  }
}

export async function startTask(taskId: string, prompt: string, workspace: string): Promise<void> {
  // 若已有运行中的同名会话,先停掉
  stopTask(taskId)

  const controller = new AbortController()
  sessions.set(taskId, { taskId, controller, workspace })

  const stream = query({
    prompt,
    options: {
      cwd: workspace,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      includePartialMessages: false,
      abortController: controller,
    },
  })

  try {
    for await (const sdkMsg of stream) {
      if (sdkMsg.type === 'system' && (sdkMsg as any).subtype === 'init') {
        const s = sessions.get(taskId)
        if (s) s.sessionId = (sdkMsg as any).session_id
      }
      const mapped = mapToAgentMessage(sdkMsg)
      if (mapped) send(taskId, mapped)
    }
  } catch (err) {
    // 用户主动停止(abort)不算错误,不污染 renderer 的 stopped 状态
    if (!controller.signal.aborted) {
      send(taskId, { role: 'system', kind: 'error', meta: { error: String(err) } })
    }
  } finally {
    // 正常完成或出错都清理 session;带 controller 身份 guard 防止与并发 re-startTask 竞争
    if (sessions.get(taskId)?.controller === controller) sessions.delete(taskId)
  }
}

export function stopTask(taskId: string): void {
  const s = sessions.get(taskId)
  if (!s) return
  s.controller.abort()
  sessions.delete(taskId)
}

export async function checkClaude(): Promise<ClaudeCheckResult> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['--version'], { shell: true })
    let out = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.on('error', () => resolve({ installed: false }))
    child.on('close', (code) => {
      if (code === 0) resolve({ installed: true, version: out.trim() || undefined })
      else resolve({ installed: false })
    })
  })
}
