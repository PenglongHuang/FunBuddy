import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentMessage, ToolUse } from '../shared/agent-types'

/**
 * 把 SDK 的 SDKMessage 映射成 renderer 用的 AgentMessage。
 * 返回 null 表示 MVP 阶段忽略(stream_event / user 回显 / 其他)。
 * 这是纯函数,可单测;不依赖 electron。
 */
export function mapToAgentMessage(msg: SDKMessage): AgentMessage | null {
  if (msg.type === 'system' && (msg as any).subtype === 'init') {
    return {
      role: 'system',
      kind: 'init',
      meta: { sessionId: (msg as any).session_id, model: (msg as any).model },
    }
  }

  if (msg.type === 'assistant') {
    const blocks = ((msg as any).message?.content ?? []) as Array<{ type: string; text?: string; name?: string; input?: unknown }>
    let text = ''
    const toolUses: ToolUse[] = []
    for (const b of blocks) {
      if (b.type === 'text' && typeof b.text === 'string') text += b.text
      else if (b.type === 'tool_use' && b.name) toolUses.push({ name: b.name, input: b.input })
    }
    return { role: 'assistant', text, toolUses }
  }

  if (msg.type === 'result') {
    return {
      role: 'system',
      kind: 'result',
      meta: {
        isError: (msg as any).is_error,
        subtype: (msg as any).subtype,
        result: (msg as any).result,
        costUsd: (msg as any).total_cost_usd,
        numTurns: (msg as any).num_turns,
      },
    }
  }

  // stream_event / user / 其他:MVP 忽略
  return null
}
