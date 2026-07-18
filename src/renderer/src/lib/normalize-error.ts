/**
 * 把 SDK/系统抛出的原始错误串归一成对用户友好的 { title, detail }。
 * 只做格式归一化(取首行、去常见前缀、截断),不做语义分类。
 * detail 为完整原文(供「复制错误」),与 title 相同时留空。
 */
import { firstNonEmptyLine } from './string-util'

export function normalizeErrorMessage(raw: string): { title: string; detail: string } {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { title: '未知错误', detail: '' }

  const title = clip(stripPrefix(firstNonEmptyLine(trimmed)), 120)
  // detail 保留完整原文供「复制错误」;仅当与最终 title 完全相同时留空
  const detail = title === trimmed ? '' : trimmed
  return { title, detail }
}

const NOISY_PREFIXES = [
  /^Error occurred in handler for '[^']*':\s*/,
  /^error:\s*/i,
  /^uncaught\s+\w*error:\s*/i,
]

function stripPrefix(line: string): string {
  for (const re of NOISY_PREFIXES) {
    if (!re.test(line)) continue
    const out = line.replace(re, '').trim()
    if (out) return out
  }
  return line
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

/**
 * 把一条 system 错误消息(error / result+isError)归一成卡片与 toast 共用的描述。
 * 统一 prefix:卡片(ErrorCard)和 toast 都用这里的 prefix + title,避免同一事件
 * 在两处文案不一致(此前卡片带「任务执行出错：」、toast 不带)。
 * - raw:完整原文(供「复制错误」)
 * - title/detail:经 normalizeErrorMessage 归一
 */
export function describeSystemError(msg: {
  kind: string
  meta?: Record<string, unknown>
}): { prefix: string; title: string; detail: string; raw: string } {
  const meta = msg.meta ?? {}
  if (msg.kind === 'error') {
    const raw = String(meta.error ?? '')
    const { title, detail } = normalizeErrorMessage(raw)
    return { prefix: '⚠ ', title, detail, raw }
  }
  // result + isError
  const raw = String(meta.result ?? meta.subtype ?? '')
  const { title, detail } = normalizeErrorMessage(raw)
  return { prefix: '⚠ 任务执行出错：', title, detail, raw }
}
