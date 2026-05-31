const WIKILINK_REGEX = /\[\[([a-zA-Z0-9_-]{6,21})\|((?:[^\]]|\](?!\]))*)\]\]/g

export interface ParsedLink {
  id: string
  title: string
  fullMatch: string
  index: number
}

export function parseLinks(text: string): ParsedLink[] {
  const links: ParsedLink[] = []
  let match
  while ((match = WIKILINK_REGEX.exec(text)) !== null) {
    links.push({
      id: match[1],
      title: match[2],
      fullMatch: match[0],
      index: match.index,
    })
  }
  return links
}

export type LinkType = 'plan' | 'note' | 'deleted'

export interface ResolvedLink {
  id: string
  title: string
  type: LinkType
}

export function replaceLinksWithHtml(
  text: string,
  resolvedLinks: Map<string, ResolvedLink>,
): string {
  return text.replace(WIKILINK_REGEX, (_fullMatch, id: string, _title: string) => {
    const resolved = resolvedLinks.get(id)
    if (!resolved) {
      return `<span class="wikilink wikilink-deleted" data-link-id="${id}">[已删除]</span>`
    }
    const icon = resolved.type === 'plan' ? '📄' : '📝'
    const cssClass = resolved.type === 'plan' ? 'wikilink-plan' : 'wikilink-note'
    return `<span class="wikilink ${cssClass}" data-link-id="${id}" data-link-type="${resolved.type}">${icon} ${escapeHtml(resolved.title)}</span>`
  })
}

/**
 * 转义非 HTML 标签的 `<`，保留 <tag>, </tag>, <!-- --> 等合法 HTML。
 * 防止 marked 将 <xxx> 误解析为 HTML 标签（如 <研究与探索>）。
 */
export function escapeRawAngles(text: string): string {
  let result = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '<') {
      const rest = text.slice(i)
      const commentMatch = rest.match(/^<!--[\s\S]*?-->/)
      const tagMatch = rest.match(/^<\/?[a-zA-Z][a-zA-Z0-9:-]*(\s[^>]*)?\/?>/)
      if (commentMatch) {
        result += commentMatch[0]; i += commentMatch[0].length
      } else if (tagMatch) {
        result += tagMatch[0]; i += tagMatch[0].length
      } else {
        result += '&lt;'; i += 1
      }
    } else {
      result += text[i]; i += 1
    }
  }
  return result
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const FENCED_CODE_REGEX = /(`{3,}|~{3,})([\s\S]*?)\1/g
const INLINE_CODE_REGEX = /`([^`\n]+)`/g

export function maskCodeBlocks(text: string): { masked: string; restore: (processed: string) => string } {
  const originals: string[] = []
  const mask = (match: string): string => {
    const index = originals.length
    originals.push(match)
    return `\x00${index}\x00`
  }
  let masked = text.replace(FENCED_CODE_REGEX, mask)
  masked = masked.replace(INLINE_CODE_REGEX, mask)
  return {
    masked,
    restore: (processed: string) => {
      return processed.replace(/\x00(\d+)\x00/g, (_, idx) => originals[parseInt(idx, 10)])
    },
  }
}
