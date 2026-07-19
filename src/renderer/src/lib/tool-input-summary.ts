import type { ToolResult } from '../../../shared/agent-types'
import { firstNonEmptyLine } from './string-util'

/**
 * 从工具入参里取一句最显眼的摘要(文件名/命令/模式等),用于胶囊显示。
 * 找不到则返回空串(胶囊退化为仅显示工具名)。
 */
export function summarizeToolInput(name: string, input: unknown): string {
  if (input == null || typeof input !== 'object') return ''
  const obj = input as Record<string, unknown>
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  const take = (...keys: string[]): string => {
    for (const k of keys) {
      const v = str(obj[k])
      if (v) return v
    }
    return ''
  }

  switch (name) {
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return clip(basename(take('file_path', 'filePath', 'notebook_path')))
    case 'Bash':
      return firstLine(take('command'))
    case 'Grep':
      return clip(take('pattern'))
    case 'Glob':
      return clip(take('pattern'))
    case 'Task':
    case 'Agent':
      return firstLine(take('description', 'prompt'))
    case 'WebSearch':
      return clip(take('query'))
    case 'WebFetch':
      return clip(take('url', 'prompt'))
    default:
      return ''
  }
}

function basename(p: string): string {
  if (!p) return ''
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts[parts.length - 1] ?? p
}

function firstLine(s: string): string {
  const line = (s.split(/\r?\n/)[0] ?? '').trim()
  return clip(line)
}

function clip(s: string, max = 60): string {
  const t = s.trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

/** 生成 tool_result 的一行摘要,贴在 ToolPill 文案后。chars 是字符数(非字节)。 */
export function summarizeToolResult(r: ToolResult): string {
  if (r.isError) {
    const first = firstNonEmptyLine(r.content)
    return '✗ ' + clip(first || '执行失败', 40)
  }
  if (!r.content || r.chars === 0) return '✓ 空'
  return `✓ ${formatChars(r.chars)} 字 · ${r.lines} 行`
}

/** 字符数量级简写(非字节):<1000 原样,否则 K/M。 */
function formatChars(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1000000).toFixed(1)}M`
}

/** 工具调用的展示状态:无结果=进行中,有结果按是否出错。用于纵向列表的状态点。 */
export type ToolStatus = 'pending' | 'success' | 'error'

/**
 * 判定工具调用的展示状态。参数放宽为结构类型(只看 result.isError),
 * 既兼容 ToolUse,又便于单测构造,不硬依赖完整 ToolUse 形状。
 */
export function toolStatus(t: { result?: { isError?: boolean } | null }): ToolStatus {
  if (!t.result) return 'pending'
  return t.result.isError ? 'error' : 'success'
}
