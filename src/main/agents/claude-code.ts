import { spawn } from 'child_process'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { mapToAgentMessage } from '../claude-message-mapper'
import { TurnAssembler, type StreamEvent } from '../claude-stream-assembler'
import type { AgentMessage, ProviderInfo } from '../../shared/agent-types'
import type { CodingAgentProvider, ProviderStartOptions } from './types'

/** partial 转发节流间隔:避免每个 token 都触发 IPC+重渲染 */
const PARTIAL_THROTTLE_MS = 40

/** 每次 runTask 自增,拼进消息 id,保证跨调用唯一(防 resume 续问撞 id) */
let callSeq = 0

interface TurnState {
  /** 当前 assistant turn 的序号(每个 message_start 自增),用于生成稳定消息 id */
  turnIndex: number
  /** 当前 turn 的装配器;收到权威 assistant 消息后置 null,等下个 message_start 重建 */
  assembler: TurnAssembler | null
  /** 上次转发 partial 的时间戳,用于节流 */
  lastFlushAt: number
}

/** 探测本机 claude CLI 版本;未装返回 null */
function detectClaudeVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['--version'], { shell: true })
    let out = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.on('error', () => resolve(null))
    child.on('close', (code) => resolve(code === 0 ? (out.trim() || null) : null))
  })
}

/**
 * 处理流式 stream_event:装配 partial 并(节流后)回吐。
 * 节流:块边界(工具出现/完成)始终立即回吐,文本增量最多每 40ms 一次。
 */
function handleStreamEvent(
  rawEvent: StreamEvent,
  st: TurnState,
  taskId: string,
  callId: number,
  onMessage: (m: AgentMessage) => void,
): void {
  // 每个 message_start 开启一个新的 assistant turn
  if (rawEvent.type === 'message_start') {
    st.turnIndex += 1
    st.assembler = new TurnAssembler(`${taskId}#${callId}#${st.turnIndex}`)
    st.lastFlushAt = 0
  }

  const assembler = st.assembler
  if (!assembler) return
  const emit = assembler.feed(rawEvent)
  if (!emit) return

  const isBoundary =
    rawEvent.type === 'content_block_start' || rawEvent.type === 'content_block_stop'
  const now = Date.now()
  if (!isBoundary && now - st.lastFlushAt < PARTIAL_THROTTLE_MS) return
  st.lastFlushAt = now

  onMessage({
    role: 'assistant',
    id: emit.id,
    text: emit.text,
    toolUses: emit.toolUses,
    partial: true,
  })
}

/** 收到权威 assistant 消息:用最终文本/工具收尾,回吐 partial:false(同 id,store 替换)。 */
function finalizeTurn(
  sdkMsg: Parameters<typeof mapToAgentMessage>[0],
  st: TurnState,
  taskId: string,
  callId: number,
  onMessage: (m: AgentMessage) => void,
): void {
  const mapped = mapToAgentMessage(sdkMsg)
  if (!mapped || mapped.role !== 'assistant') {
    st.assembler = null
    return
  }
  const assembler = st.assembler
  const id = assembler?.id ?? `${taskId}#${callId}#${st.turnIndex}`
  const emit = assembler
    ? assembler.finalize(mapped.text, mapped.toolUses)
    : { id, text: mapped.text, toolUses: mapped.toolUses }
  onMessage({
    role: 'assistant',
    id: emit.id,
    text: emit.text,
    toolUses: emit.toolUses,
    partial: false,
  })
  st.assembler = null
}

/**
 * Claude Code provider —— 基于本地 `claude` CLI(@anthropic-ai/claude-agent-sdk)。
 * 续接历史靠 options.resume = sessionId。
 */
export const claudeCodeProvider: CodingAgentProvider = {
  id: 'claude-code',
  displayName: 'Claude Code',

  async checkAvailability(): Promise<ProviderInfo> {
    const version = await detectClaudeVersion()
    return {
      providerId: 'claude-code',
      displayName: 'Claude Code',
      available: version !== null,
      version: version ?? undefined,
    }
  },

  async runTask(opts: ProviderStartOptions, onMessage, controller): Promise<void> {
    const { taskId, prompt, workspace, sessionId } = opts
    const callId = ++callSeq
    const st: TurnState = { turnIndex: 0, assembler: null, lastFlushAt: 0 }

    // [诊断] 确认 resume 是否真带上了 sessionId —— 排查"会话内追问丢历史"。
    // 第二轮追问时这里应打印非空 sessionId;为空说明 store 没把 sessionId 透传过来。
    console.log(
      `[agent:claude-code] runTask taskId=${taskId} cwd=${workspace} resume=${sessionId ? sessionId : '(none — 首轮/新会话)'}`,
    )

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

    for await (const sdkMsg of stream) {
      // [诊断] init 回传的 session_id:若本轮带了 resume,确认续接的是否同一个 session
      if (sdkMsg.type === 'system' && (sdkMsg as { subtype?: string }).subtype === 'init') {
        const sid = (sdkMsg as { session_id?: string }).session_id
        console.log(
          `[agent:claude-code] init session_id=${sid ?? '(missing)'}` +
            (sessionId ? ` (传入 resume=${sessionId}, ${sessionId === sid ? '续接同一 session' : '⚠ 与传入不一致'})` : ''),
        )
      }

      if (sdkMsg.type === 'stream_event') {
        handleStreamEvent(sdkMsg.event as unknown as StreamEvent, st, taskId, callId, onMessage)
        continue
      }
      if (sdkMsg.type === 'assistant') {
        finalizeTurn(sdkMsg, st, taskId, callId, onMessage)
        continue
      }
      const mapped = mapToAgentMessage(sdkMsg)
      if (mapped) onMessage(mapped)
    }
  },
}
