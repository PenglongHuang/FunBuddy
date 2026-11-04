import { escapeHtml } from './string-util'

const STYLE = 'max-width:100%;border-radius:var(--radius-sm)'

export interface MarkdownImageToken {
  href?: string | null
  title?: string | null
  text?: string | null
}

/**
 * marked image 渲染器的纯函数版。
 * 所有插值进 HTML 属性的值（href/title/text）必须先 escapeHtml，
 * 防止 `![a" onerror="alert(1)"](./assets/imgs/x.png)` 类属性逃逸。
 */
export function renderMarkdownImage(
  { href, title, text }: MarkdownImageToken,
  imageMap: Record<string, string>,
): string {
  const alt = escapeHtml(text || '')
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
  const isLocalAsset = href?.includes('/assets/')
  if (isLocalAsset) {
    const dataUrl = href ? imageMap[href] : undefined
    if (dataUrl) return `<img src="${dataUrl}" alt="${alt}"${titleAttr} style="${STYLE}">`
    const fileName = escapeHtml(href!.split('/').pop() || href!)
    return `<div style="padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:var(--radius-sm);color:var(--text-tertiary);font-size:12px;text-align:center">图片未找到: ${alt || fileName}</div>`
  }
  return `<img src="${escapeHtml(href || '')}" alt="${alt}"${titleAttr} style="${STYLE}">`
}
