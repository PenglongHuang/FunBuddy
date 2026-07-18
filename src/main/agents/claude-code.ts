import { logger } from '../logger'
import path from 'node:path'
import { app } from 'electron'
import { spawn } from 'child_process'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { mapToAgentMessage, extractToolResults } from '../claude-message-mapper'
import { TurnAssembler, type StreamEvent } from '../claude-stream-assembler'
import { summarizeToolResultSize } from '../../shared/tool-result-util'
import type { AgentMessage, ProviderInfo } from '../../shared/agent-types'
import type { CodingAgentProvider, ProviderStartOptions } from './types'
import { NOTES_SYSTEM_PROMPT } from './notes-system-prompt'

/**
 * `${platform}-${arch}` -> SDK 原生二进制子包名。SDK 内部按此约定分发 claude CLI。
 * 仅列出本应用当前打包的目标(electron-builder 只出 win-x64);新增平台时在此追加。
 */
const NATIVE_BIN_PACKAGE: Record<string, string> = {
  'win32-x64': '@anthropic-ai/claude-agent-sdk-win32-x64',
}

/**
 * 解析 claude CLI 可执行文件的真实路径,供 SDK 的 pathToClaudeCodeExecutable 使用。
 *
 * 打包后 SDK 会把二进制解析进 app.asar 虚拟路径(如 ...\app.asar\node_modules\...
 * \claude.exe),Windows 无法从 asar 归档内 CreateProcess,SDK 便抛
 * "exists but failed to launch"(原错误里 musl/libc 的提示只是通用 Linux 文案,
 * 与 Windows 无关)。electron-builder 已把该原生二进制 unpack 到 app.asar.unpacked,
 * 这里把路径段 app.asar 改写为 app.asar.unpacked 即可拿到真实文件。dev 下返回
 * undefined,沿用 SDK 自带解析(node_modules 是真实文件,可正常 spawn)。
 */
function resolveClaudeExecutable(): string | undefined {
  if (!app.isPackaged) return undefined
  const pkg = NATIVE_BIN_PACKAGE[`${process.platform}-${process.arch}`]
  if (!pkg) return undefined
  const exeName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const candidate = path.join(app.getAppPath(), 'node_modules', pkg, exeName)
  const asarSeg = `${path.sep}app.asar${path.sep}`
  return candidate.includes(asarSeg)
    ? candidate.replace(asarSeg, `${path.sep}app.asar.unpacked${path.sep}`)
    : candidate
}

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
    const claudeExe = resolveClaudeExecutable()

    const stream = query({
      prompt,
      options: {
        cwd: workspace,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        abortController: controller,
        systemPrompt: { type: 'preset', preset: 'claude_code', append: NOTES_SYSTEM_PROMPT },
        // 打包后必须显式指向 app.asar.unpacked 里的真实二进制,否则 SDK 会去 spawn
        // app.asar 内的虚拟路径而启动失败(详见 resolveClaudeExecutable)。
        ...(claudeExe ? { pathToClaudeCodeExecutable: claudeExe } : {}),
        ...(sessionId ? { resume: sessionId } : {}),
      },
    })

    try {
      for await (const sdkMsg of stream) {
        if (sdkMsg.type === 'stream_event') {
          handleStreamEvent(sdkMsg.event as unknown as StreamEvent, st, taskId, callId, onMessage)
          continue
        }
        if (sdkMsg.type === 'assistant') {
          finalizeTurn(sdkMsg, st, taskId, callId, onMessage)
          continue
        }
        if (sdkMsg.type === 'user') {
          for (const r of extractToolResults(sdkMsg)) {
            const { chars, lines } = summarizeToolResultSize(r.content)
            onMessage({
              role: 'system',
              kind: 'tool_result',
              meta: { toolUseId: r.toolUseId, content: r.content, isError: r.isError, chars, lines },
            })
          }
          continue
        }
        const mapped = mapToAgentMessage(sdkMsg)
        if (mapped) onMessage(mapped)
      }
    } catch (err) {
      // 用户主动停止(abort)不算错误:claude-service 也按 signal.aborted 抑制 renderer 通知。
      if (!controller.signal.aborted) {
        logger.error(
          `[agent:claude-code] stream error for taskId=${taskId} workspace=${workspace}:`,
          err,
        )
      }
      throw err
    }
  },
}
