import type { AgentMessage, ToolResult } from './agent-types'

/**
 * 在消息流里按 tool_use_id 定位某个 assistant.toolUses[i]。
 * live ingest(单条 tool_result 到达)与历史回填(批量 transcript)共用。
 * 从后往前扫:tool_result 通常紧跟其 tool_use,绝大多数命中在表尾,O(1) 量级。
 */
export function locateToolUse(
  messages: AgentMessage[],
  toolUseId: string,
): { msgIdx: number; toolIdx: number } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'assistant') continue
    for (let j = m.toolUses.length - 1; j >= 0; j--) {
      if (m.toolUses[j].id === toolUseId) return { msgIdx: i, toolIdx: j }
    }
  }
  return null
}

/**
 * 把 tool_result 按 id 挂到所属 assistant.toolUses[i].result。
 * live ingest(agentStore,单条)与历史回填(mapSessionTranscript,批量)共用,
 * 避免「定位 + role 校验 + 赋值」这段逻辑在主进程和渲染进程各写一份。
 * 批量回填可传 index(O(1) 查找,跳过全表扫描);live 不传则反向扫描。
 * 返回是否成功挂载(找不到归属或 owner 非 assistant 时返回 false,安全忽略)。
 */
export function attachToolResult(
  messages: AgentMessage[],
  toolUseId: string,
  result: ToolResult,
  index?: Map<string, { msgIdx: number; toolIdx: number }>,
): boolean {
  const loc = index?.get(toolUseId) ?? locateToolUse(messages, toolUseId)
  if (!loc) return false
  const owner = messages[loc.msgIdx]
  if (owner.role !== 'assistant') return false
  owner.toolUses[loc.toolIdx].result = result
  return true
}

/**
 * 算 tool_result content 的规模,供摘要行显示。
 * lines 为换行分割段数(尾随换行会使行数偏多 1,仅作规模概览)。
 */
export function summarizeToolResultSize(content: string): { chars: number; lines: number } {
  const lines = content === '' ? 0 : content.split(/\r?\n/).length
  return { chars: content.length, lines }
}

/** 把 tool_result 的 content(string | 文本块数组 | 其他)归一成字符串。图片等非文本块按 MVP 丢弃为空。 */
export function flattenToolResultContent(c: unknown): string {
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return c.map((x: any) => (x && typeof x.text === 'string' ? x.text : '')).join('')
  return c == null ? '' : String(c)
}
