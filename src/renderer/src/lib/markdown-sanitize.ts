import DOMPurify from 'dompurify'

/**
 * MarkdownPreview 与 export-pdf 共用的最终消毒配置。
 * - ADD_TAGS iframe: 恢复视频嵌入(默认配置会静默丢弃 <iframe>)。安全依据:
 *   1) DOMPurify 默认 URI regexp 不含 file: —— iframe src 只能是 http(s) 等远程源;
 *   2) on* 事件属性默认全剥;
 *   3) iframe 内加载的是远程页面,无 preload、无 window.api,拿不到特权 IPC。
 * - ADD_ATTR target: linkTarget='_blank' 渲染器产出的新窗口链接需要保留 target。
 */
export const MARKDOWN_SANITIZE_OPTIONS = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['target'],
}

/**
 * 纵深防御：escapeRawAngles 有意放行合法形态的 HTML 标签，最终产物必须过 DOMPurify。
 * DOMPurify 在 node 测试环境（无 window）不生效——生产渲染器始终有 window；
 * isSupported=false 时回退原文，保证纵深防御只在真实 DOM 环境启用。
 */
export function sanitizeMarkdownHtml(raw: string): string {
  return DOMPurify.isSupported ? DOMPurify.sanitize(raw, MARKDOWN_SANITIZE_OPTIONS) : raw
}
