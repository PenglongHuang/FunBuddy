import { getMainWindow } from './window'
import { logger } from './logger'
import { IPC } from '../shared/ipc-channels'
import { getActiveProvider } from './agents/registry'
import type { AgentMessage, ProviderInfo } from '../shared/agent-types'

/**
 * 薄编排层:只负责通用任务生命周期(任务注册、取消、错误兜底、IPC 转发),
 * 真正的 Coding Agent 后端逻辑委托给当前绑定的 provider(见 agents/)。
 * 换 provider 不用动这里。
 */
interface SessionState {
  controller: AbortController
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

export async function startTask(
  taskId: string,
  prompt: string,
  workspace: string,
  sessionId?: string,
): Promise<void> {
  // 若已有运行中的同名会话,先停掉
  stopTask(taskId)

  const controller = new AbortController()
  sessions.set(taskId, { controller })

  try {
    await getActiveProvider().runTask(
      { taskId, prompt, workspace, sessionId },
      (msg) => send(taskId, msg),
      controller,
    )
  } catch (err) {
    // 用户主动停止(abort)不算错误,不污染 renderer 的 stopped 状态
    if (!controller.signal.aborted) {
      logger.error(`[claude-service] startTask failed for taskId=${taskId}:`, err)
      send(taskId, { role: 'system', kind: 'error', meta: { error: String(err) } })
    }
  } finally {
    // 带 controller 身份 guard 防止与并发 re-startTask 竞争
    if (sessions.get(taskId)?.controller === controller) sessions.delete(taskId)
  }
}

export function stopTask(taskId: string): void {
  const s = sessions.get(taskId)
  if (!s) return
  s.controller.abort()
  sessions.delete(taskId)
}

/** 当前绑定 provider 的可用性(供设置页展示)。 */
export async function getProviderInfo(): Promise<ProviderInfo> {
  return getActiveProvider().checkAvailability()
}
