export interface OperationResult {
  text: string
  start: number
  end: number
}

export type MarkdownOperation = (text: string, start: number, end: number) => OperationResult

function wrapWith(text: string, start: number, end: number, marker: string): OperationResult {
  const selected = text.substring(start, end)
  const wrapped = `${marker}${selected}${marker}`

  if (
    start >= marker.length &&
    end <= text.length - marker.length &&
    text.substring(start - marker.length, start) === marker &&
    text.substring(end, end + marker.length) === marker &&
    (start < marker.length || text[start - marker.length - 1] !== marker[0]) &&
    (end + marker.length >= text.length || text[end + marker.length] !== marker[0])
  ) {
    return {
      text: text.substring(0, start - marker.length) + selected + text.substring(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    }
  }

  return {
    text: text.substring(0, start) + wrapped + text.substring(end),
    start: start + marker.length,
    end: end + marker.length,
  }
}

export const wrapBold = (text: string, start: number, end: number): OperationResult =>
  wrapWith(text, start, end, '**')

export const wrapItalic = (text: string, start: number, end: number): OperationResult =>
  wrapWith(text, start, end, '*')

export const wrapStrikethrough = (text: string, start: number, end: number): OperationResult =>
  wrapWith(text, start, end, '~~')

export const wrapHighlight = (text: string, start: number, end: number): OperationResult =>
  wrapWith(text, start, end, '==')

export const wrapInlineCode = (text: string, start: number, end: number): OperationResult =>
  wrapWith(text, start, end, '`')

function getLineStart(text: string, pos: number): number {
  const i = text.lastIndexOf('\n', pos - 1)
  return i === -1 ? 0 : i + 1
}

function getLineEnd(text: string, pos: number): number {
  const i = text.indexOf('\n', pos)
  return i === -1 ? text.length : i
}

function toggleLinePrefix(text: string, pos: number, prefix: string): OperationResult {
  const lineStart = getLineStart(text, pos)
  const lineEnd = getLineEnd(text, pos)
  const lineContent = text.substring(lineStart, lineEnd)

  if (lineContent.startsWith(prefix)) {
    const newLine = lineContent.substring(prefix.length)
    return {
      text: text.substring(0, lineStart) + newLine + text.substring(lineEnd),
      start: lineStart,
      end: lineStart + newLine.length,
    }
  }

  const newLine = prefix + lineContent
  return {
    text: text.substring(0, lineStart) + newLine + text.substring(lineEnd),
    start: lineStart + prefix.length,
    end: lineStart + newLine.length,
  }
}

export function toggleHeading(level: 1 | 2 | 3 | 4 | 5 | 6): MarkdownOperation {
  return (text: string, start: number, _end: number): OperationResult => {
    const lineStart = getLineStart(text, start)
    const lineEnd = getLineEnd(text, start)
    const lineContent = text.substring(lineStart, lineEnd)

    const headingMatch = lineContent.match(/^(#{1,6})\s+(.*)/)
    if (headingMatch) {
      const currentLevel = headingMatch[1].length
      const rest = headingMatch[2]

      if (currentLevel === level) {
        return {
          text: text.substring(0, lineStart) + rest + text.substring(lineEnd),
          start: lineStart,
          end: lineStart + rest.length,
        }
      }

      const newPrefix = '#'.repeat(level) + ' '
      const newLine = newPrefix + rest
      return {
        text: text.substring(0, lineStart) + newLine + text.substring(lineEnd),
        start: lineStart + newPrefix.length,
        end: lineStart + newLine.length,
      }
    }

    const prefix = '#'.repeat(level) + ' '
    const newLine = prefix + lineContent.trimStart()
    return {
      text: text.substring(0, lineStart) + newLine + text.substring(lineEnd),
      start: lineStart + prefix.length,
      end: lineStart + newLine.length,
    }
  }
}

export const toggleBlockquote: MarkdownOperation = (text, start, _end): OperationResult =>
  toggleLinePrefix(text, start, '> ')

export const toggleUnorderedList: MarkdownOperation = (text, start, _end): OperationResult =>
  toggleLinePrefix(text, start, '- ')

export const toggleOrderedList: MarkdownOperation = (text, start, _end): OperationResult =>
  toggleLinePrefix(text, start, '1. ')

export const toggleTaskList: MarkdownOperation = (text, start, _end): OperationResult =>
  toggleLinePrefix(text, start, '- [ ] ')

export const insertLink: MarkdownOperation = (text, start, end): OperationResult => {
  const selected = text.substring(start, end)
  const linkText = selected || 'text'
  const inserted = `[${linkText}](url)`
  return {
    text: text.substring(0, start) + inserted + text.substring(end),
    start: start + 1,
    end: start + 1 + linkText.length,
  }
}

export const insertTable: MarkdownOperation = (text, start, _end): OperationResult => {
  const template = '\n| 列1 | 列2 |\n| --- | --- |\n|  |  |\n'
  return {
    text: text.substring(0, start) + template + text.substring(start),
    start: start + template.length,
    end: start + template.length,
  }
}

export const insertHorizontalRule: MarkdownOperation = (text, start, _end): OperationResult => {
  const hr = '\n---\n'
  return {
    text: text.substring(0, start) + hr + text.substring(start),
    start: start + hr.length,
    end: start + hr.length,
  }
}

export const insertImage: MarkdownOperation = (text, start, _end): OperationResult => {
  const inserted = '![alt](url)'
  return {
    text: text.substring(0, start) + inserted + text.substring(start),
    start: start + 2,
    end: start + 5,
  }
}

export const insertCodeBlock: MarkdownOperation = (text, start, end): OperationResult => {
  const selected = text.substring(start, end)
  const code = selected || 'code'
  const inserted = '```\n' + code + '\n```'
  return {
    text: text.substring(0, start) + inserted + text.substring(end),
    start: start + 4,
    end: start + 4 + code.length,
  }
}

export function createInsertImageWithPath(relativePath: string, altText: string): MarkdownOperation {
  return (text, start, _end): OperationResult => {
    const inserted = `![${altText}](${relativePath})`
    return {
      text: text.substring(0, start) + inserted + text.substring(start),
      start: start + 2,
      end: start + 2 + altText.length,
    }
  }
}

export function createInsertLinkRef(id: string, title: string): MarkdownOperation {
  return (text, start, _end): OperationResult => {
    const inserted = `[[${id}|${title}]]`
    const newPos = start + inserted.length
    return {
      text: text.substring(0, start) + inserted + text.substring(start),
      start: newPos,
      end: newPos,
    }
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export async function pasteFromClipboard(): Promise<string> {
  return await navigator.clipboard.readText()
}

export function applyOperationToTextarea(
  textarea: HTMLTextAreaElement,
  oldText: string,
  newText: string,
  cursorStart: number,
  cursorEnd: number,
): void {
  let start = 0
  const minLen = Math.min(oldText.length, newText.length)
  while (start < minLen && oldText[start] === newText[start]) start++

  let oldEnd = oldText.length
  let newEnd = newText.length
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--
    newEnd--
  }

  textarea.focus()
  textarea.selectionStart = start
  textarea.selectionEnd = oldEnd
  document.execCommand('insertText', false, newText.substring(start, newEnd))

  requestAnimationFrame(() => {
    textarea.setSelectionRange(cursorStart, cursorEnd)
  })
}
