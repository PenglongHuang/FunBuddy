export function lineIndexToOffset(content: string, lineIndex: number): number {
  if (lineIndex <= 0) return 0

  let offset = 0
  for (let index = 0; index < lineIndex; index += 1) {
    const newlineOffset = content.indexOf('\n', offset)
    if (newlineOffset === -1) return content.length
    offset = newlineOffset + 1
  }

  return offset
}

export function hasLinkTrigger(content: string, triggerStart: number): boolean {
  return content.slice(triggerStart, triggerStart + 2) === '[[' || content[triggerStart] === '@'
}
