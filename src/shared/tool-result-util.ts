import type { AgentMessage } from './agent-types'

/**
 * 在消息流里按 tool_use_id 定位某个 assistant.toolUses[i]。
 * live ingest(单条 tool_result 到达)与历史回填(批量 transcript)共用。
 */
export function locateToolUse(
  messages: AgentMessage[],
  toolUseId: string,
): { msgIdx: number; toolIdx: number } | null {
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (m.role !== 'assistant') continue
    for (let j = 0; j < m.toolUses.length; j++) {
      if (m.toolUses[j].id === toolUseId) return { msgIdx: i, toolIdx: j }
    }
  }
  return null
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
