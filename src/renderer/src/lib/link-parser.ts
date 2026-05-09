const WIKILINK_REGEX = /\[\[([a-zA-Z0-9_-]{6,21})\|([^\]]*)\]\]/g

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
