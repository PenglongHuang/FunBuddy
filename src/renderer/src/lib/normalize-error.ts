/**
 * 把 SDK/系统抛出的原始错误串归一成对用户友好的 { title, detail }。
 * 只做格式归一化(取首行、去常见前缀、截断),不做语义分类。
 * detail 为完整原文(供「复制错误」),与 title 相同时留空。
 */
export function normalizeErrorMessage(raw: string): { title: string; detail: string } {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { title: '未知错误', detail: '' }

  const firstLine = trimmed.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) as string
  const title = clip(stripPrefix(firstLine), 120)
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
