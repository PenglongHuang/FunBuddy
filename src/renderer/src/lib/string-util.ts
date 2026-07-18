/** HTML 文本/属性值转义:& < > "。读回 dataset 时浏览器自动反转义。 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 取首个非空行(trim 后非空),跳过开头的空白行。
 * stderr / SDK 包装的错误常以空行开头,直接 split[0] 会丢掉真实首行。
 */
export function firstNonEmptyLine(s: string): string {
  const lines = s.split(/\r?\n/)
  for (const l of lines) {
    const t = l.trim()
    if (t) return t
  }
  return ''
}
