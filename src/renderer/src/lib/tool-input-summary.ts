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
