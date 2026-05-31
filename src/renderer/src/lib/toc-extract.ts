export interface TocHeading {
  level: number  // 1-6
  text: string
  lineIndex: number  // 0-based line number in source
}

const headingRegex = /^(#{1,6})\s+(.+)$/

export function extractHeadings(source: string, maxLevel = 3): TocHeading[] {
  const lines = source.split('\n')
  const headings: TocHeading[] = []
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^(`{3,}|~{3,})/.test(line)) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const match = headingRegex.exec(line)
    if (match) {
      const level = match[1].length
      if (level <= maxLevel) {
        headings.push({ level, text: match[2].trim(), lineIndex: i })
      }
    }
  }

  return headings
}
