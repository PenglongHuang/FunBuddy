/**
 * Extract the text from the first H1 heading in markdown content.
 * Returns null if no H1 found.
 */
export function extractH1Title(content: string): string | null {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      const title = trimmed.slice(2).trim()
      return title || null
    }
    // Stop at first non-empty, non-heading line to avoid false matches in code blocks
    if (trimmed.length > 0 && !trimmed.startsWith('#')) {
      return null
    }
  }
  return null
}
