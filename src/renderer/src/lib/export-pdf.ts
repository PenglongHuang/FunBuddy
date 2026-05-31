import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import { imageApi } from './ipc'
import { escapeRawAngles } from './link-parser'

// Register languages (same as MarkdownPreview)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)

export type ExportMode = 'title-body' | 'full-metadata'

export interface ExportOptions {
  content: string
  mdFilePath: string
  title: string
  mode: ExportMode
  fileName: string
  meta?: {
    tags?: string[]
    createdAt?: string
    planType?: string
    startDate?: string
    endDate?: string | null
  }
}

const IMAGE_REF_REGEX = /!\[[^\]]*\]\(([^)]*\/assets\/[^)]+)\)/g

const CSS = `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  padding: 0; margin: 0;
  color: #1a1a1a; line-height: 1.6; font-size: 14px;
}
h1.title {
  font-size: 24px; font-weight: 700;
  margin-bottom: 16px; padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}
.meta { font-size: 12px; color: #6b7280; margin-bottom: 12px; line-height: 1.8; }
.meta div { margin-bottom: 2px; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
.markdown-body h1 { font-size: 22px; font-weight: 600; margin: 20px 0 8px; }
.markdown-body h2 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
.markdown-body h3 { font-size: 16px; font-weight: 600; margin: 12px 0 6px; }
.markdown-body p { margin: 8px 0; }
.markdown-body ul, .markdown-body ol { padding-left: 24px; margin: 8px 0; }
.markdown-body li { margin: 4px 0; }
.markdown-body pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdown-body code { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; }
.markdown-body :not(pre) > code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
.markdown-body img { max-width: 100%; height: auto; }
.markdown-body blockquote { border-left: 3px solid #d1d5db; padding-left: 12px; color: #6b7280; margin: 8px 0; }
.markdown-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.markdown-body th, .markdown-body td { border: 1px solid #d1d5db; padding: 6px 12px; text-align: left; }
.markdown-body th { background: #f6f8fa; font-weight: 600; }
`

function buildCodeRenderer(): marked.MarkedExtension {
  const renderer = new marked.Renderer()
  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const result = hljs.highlight(text, { language: lang })
        return `<pre><code class="hljs language-${lang}">${result.value}</code></pre>`
      } catch {}
    }
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<pre><code>${escaped}</code></pre>`
  }
  return { renderer }
}

async function resolveImages(content: string, mdFilePath: string): Promise<Record<string, string>> {
  const imageMap: Record<string, string> = {}
  const refs = [...content.matchAll(IMAGE_REF_REGEX)].map((m) => m[1])
  const uniqueRefs = [...new Set(refs)]

  await Promise.all(
    uniqueRefs.map(async (ref) => {
      try {
        const result = await imageApi.readAsDataUrl(mdFilePath, ref)
        if (result?.dataUrl) imageMap[ref] = result.dataUrl
      } catch {
        // skip failed images
      }
    }),
  )

  return imageMap
}

function buildImageRenderer(imageMap: Record<string, string>): marked.MarkedExtension {
  const renderer = new marked.Renderer()
  renderer.image = function ({ href, title, text }: { href: string; title?: string; text?: string }) {
    if (href && imageMap[href]) {
      return `<img src="${imageMap[href]}" alt="${escapeAttr(text || '')}" ${title ? `title="${escapeAttr(title)}"` : ''} style="max-width:100%;height:auto" />`
    }
    return `<img src="${escapeAttr(href || '')}" alt="${escapeAttr(text || '')}" ${title ? `title="${escapeAttr(title)}"` : ''} style="max-width:100%;height:auto" />`
  }
  return { renderer }
}

function renderMetadata(meta: ExportOptions['meta']): string {
  if (!meta) return ''
  const lines: string[] = []
  if (meta.createdAt) lines.push(`<div>创建时间: ${escapeHtml(meta.createdAt)}</div>`)
  if (meta.tags?.length) lines.push(`<div>标签: ${escapeHtml(meta.tags.join(', '))}</div>`)
  if (meta.planType) lines.push(`<div>类型: ${escapeHtml(meta.planType)}</div>`)
  if (meta.startDate) lines.push(`<div>开始: ${escapeHtml(meta.startDate)}</div>`)
  if (meta.endDate) lines.push(`<div>结束: ${escapeHtml(meta.endDate)}</div>`)
  return `<div class="meta">${lines.join('')}</div><hr>`
}

async function renderMarkdown(content: string, mdFilePath: string): Promise<string> {
  const imageMap = await resolveImages(content, mdFilePath)

  marked.use({ gfm: true, breaks: true })
  marked.use(buildCodeRenderer())
  marked.use(buildImageRenderer(imageMap))

  return marked.parse(escapeRawAngles(content), { async: false }) as string
}

export async function buildExportHtml(options: ExportOptions): Promise<string> {
  const body = await renderMarkdown(options.content, options.mdFilePath)
  const metaHtml = options.mode === 'full-metadata' ? renderMetadata(options.meta) : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
<h1 class="title">${escapeHtml(options.title)}</h1>
${metaHtml}
<div class="markdown-body">${body}</div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeAttr(str: string): string {
  return escapeHtml(str)
}
