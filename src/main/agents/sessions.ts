import {
  listSessions,
  getSessionMessages,
  getSessionInfo,
  deleteSession,
  type SDKSessionInfo,
} from '@anthropic-ai/claude-agent-sdk'
import type { AgentMessage } from '../../shared/agent-types'
import { sessionMessageToAgentMessage } from './session-message-mapper'

/**
 * 查询 CLI 会话真相源(~/.claude/projects/<encoded-cwd>/<sid>.jsonl)的封装层。
 * 所有 SDK 调用都收拢在这里,renderer 经 IPC 调用。
 */

/** 列举会话(默认含 worktree)。按 lastModified 倒序,SDK 已保证。 */
export async function listAgentSessions(opts: {
  dir: string
  limit?: number
}): Promise<SDKSessionInfo[]> {
  return listSessions({
    dir: opts.dir,
    limit: opts.limit,
    includeWorktrees: true,
  })
}

/** 读取某会话的消息链,映射成 AgentMessage,过滤掉 subagent/无法识别的条目。 */
export async function getAgentSessionMessages(
  sessionId: string,
  opts: { dir: string },
): Promise<AgentMessage[]> {
  const raw = await getSessionMessages(sessionId, { dir: opts.dir })
  const mapped: AgentMessage[] = []
  for (const entry of raw) {
    const m = sessionMessageToAgentMessage(entry as Parameters<typeof sessionMessageToAgentMessage>[0])
    if (m) mapped.push(m)
  }
  return mapped
}

/** 探测 sessionId 是否仍在 CLI 真相源中(未过期/未被清)。迁移用。 */
export async function sessionExists(
  sessionId: string,
  dir: string,
): Promise<boolean> {
  const info = await getSessionInfo(sessionId, { dir })
  return info !== undefined
}

/** 删除会话(best-effort,孤儿清理;失败吞掉,因为 CLI 那侧可能已不存在)。 */
export async function deleteAgentSession(
  sessionId: string,
  dir: string,
): Promise<void> {
  try {
    await deleteSession(sessionId, { dir })
  } catch {
    /* best-effort:CLI 侧已不存在就算成功 */
  }
}
