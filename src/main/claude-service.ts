import { spawn } from 'child_process'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { getMainWindow } from './window'
import { IPC } from '../shared/ipc-channels'
import { mapToAgentMessage } from './claude-message-mapper'
import { TurnAssembler, type StreamEvent } from './claude-stream-assembler'
import type { AgentMessage, ClaudeCheckResult } from '../shared/agent-types'

interface SessionState {
  taskId: string
  sessionId?: string
  controller: AbortController
  workspace: string
  /** 本次 startTask 调用的单调序号,拼进消息 id,避免 resume 续问时与上一轮撞 id */
  callId: number
  /** 当前 assistant turn 的序号(每个 message_start 自增),用于生成稳定消息 id */
  turnIndex: number
  /** 当前 turn 的装配器;收到权威 assistant 消息后置 null,等下个 message_start 重建 */
  assembler: TurnAssembler | null
  /** 上次转发 partial 的时间戳,用于节流 */
  lastFlushAt: number
}

/** partial 转发节流间隔:避免每个 token 都触发 IPC+重渲染 */
const PARTIAL_THROTTLE_MS = 40

/** 每次 startTask 自增,作为消息 id 的一部分,保证跨调用唯一 */
let callSeq = 0

const sessions = new Map<string, SessionState>()

function send(taskId: string, msg: AgentMessage): void {
  const win = getMainWindow()
  try {
    win?.webContents.send(IPC.AI_MESSAGE, { taskId, msg })
  } catch {
    /* window may be closed */
  }
}

export async function startTask(
  taskId: string,
  prompt: string,
  workspace: string,
  sessionId?: string,
): Promise<void> {
  // 若已有运行中的同名会话,先停掉
  stopTask(taskId)

  const controller = new AbortController()
  const callId = ++callSeq
  sessions.set(taskId, {
    taskId,
    sessionId,
    controller,
    workspace,
    callId,
    turnIndex: 0,
    assembler: null,
    lastFlushAt: 0,
  })

  const stream = query({
    prompt,
    options: {
      cwd: workspace,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      includePartialMessages: true,
      abortController: controller,
      ...(sessionId ? { resume: sessionId } : {}),
    },
  })

  try {
    for await (const sdkMsg of stream) {
      if (sdkMsg.type === 'system' && (sdkMsg as { subtype?: string }).subtype === 'init') {
        const s = sessions.get(taskId)
        if (s) s.sessionId = (sdkMsg as { session_id?: string }).session_id
      }
      if (sdkMsg.type === 'stream_event') {
        handleStreamEvent(taskId, sdkMsg.event as unknown as StreamEvent)
        continue
      }
      if (sdkMsg.type === 'assistant') {
        finalizeTurn(taskId, sdkMsg)
        continue
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

/** 处理流式 stream_event:装配 partial 并(节流后)转发给 renderer。 */
function handleStreamEvent(taskId: string, rawEvent: StreamEvent): void {
  const s = sessions.get(taskId)
  if (!s) return

  // 每个 message_start 开启一个新的 assistant turn
  if (rawEvent.type === 'message_start') {
    s.turnIndex += 1
    s.assembler = new TurnAssembler(`${taskId}#${s.callId}#${s.turnIndex}`)
    s.lastFlushAt = 0
  }

  const assembler = s.assembler
  if (!assembler) return
  const emit = assembler.feed(rawEvent)
  if (!emit) return

  // 节流:块边界(工具出现/完成)始终立即转发,文本增量最多每 40ms 一次
  const isBoundary =
    rawEvent.type === 'content_block_start' || rawEvent.type === 'content_block_stop'
  const now = Date.now()
  if (!isBoundary && now - s.lastFlushAt < PARTIAL_THROTTLE_MS) return
  s.lastFlushAt = now

  send(taskId, {
    role: 'assistant',
    id: emit.id,
    text: emit.text,
    toolUses: emit.toolUses,
    partial: true,
  })
}

/** 收到权威 assistant 消息:用最终文本/工具收尾,发出 partial:false(同 id,store 替换)。 */
function finalizeTurn(taskId: string, sdkMsg: Parameters<typeof mapToAgentMessage>[0]): void {
  const s = sessions.get(taskId)
  if (!s) return
  const mapped = mapToAgentMessage(sdkMsg)
  if (!mapped || mapped.role !== 'assistant') {
    s.assembler = null
    return
  }
  const assembler = s.assembler
  const id = assembler?.id ?? `${taskId}#${s.callId}#${s.turnIndex}`
  const emit = assembler
    ? assembler.finalize(mapped.text, mapped.toolUses)
    : { id, text: mapped.text, toolUses: mapped.toolUses }
  send(taskId, {
    role: 'assistant',
    id: emit.id,
    text: emit.text,
    toolUses: emit.toolUses,
    partial: false,
  })
  s.assembler = null
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
