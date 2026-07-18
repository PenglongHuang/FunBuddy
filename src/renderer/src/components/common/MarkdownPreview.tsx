import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react'
import { marked, type Tokens } from 'marked'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import { imageApi } from '@/lib/ipc'
import { parseLinks, replaceLinksWithHtml, maskCodeBlocks, escapeRawAngles } from '@/lib/link-parser'
import { resolveLinks } from '@/lib/link-resolver'
import { renderCodeBlock } from '@/lib/code-block'
import { escapeHtml } from '@/lib/string-util'

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

const codeRenderer = new marked.Renderer()
codeRenderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : undefined
  const highlighted = language
    ? hljs.highlight(text, { language }).value
    : escapeHtml(text)
  return renderCodeBlock(lang, text, highlighted)
}

interface MarkdownPreviewProps {
  content: string
  streaming?: boolean
  mdFilePath?: string
  onLinkClick?: (id: string, type: string) => void
  linkTarget?: '_blank'
}

export default function MarkdownPreview({ content, streaming, mdFilePath, onLinkClick, linkTarget }: MarkdownPreviewProps) {
  // 流式时让 markdown 渲染慢半拍跟随,避免每个 token 都阻塞重 parse。
  // 非流式(Notes/Planner 等)默认即时,行为不变。
  const deferredContent = useDeferredValue(content)
  const effectiveContent = streaming ? deferredContent : content

  const [imageMap, setImageMap] = useState<Record<string, string>>({})

  const imageRefs = useMemo(() => {
    const refs: string[] = []
    const regex = /!\[[^\]]*\]\(([^)]*\/assets\/[^)]+)\)/g
    let match
    while ((match = regex.exec(effectiveContent)) !== null) {
      if (match[1]) refs.push(match[1])
    }
    return refs
  }, [effectiveContent])

  const imageRefsKey = imageRefs.join(',')

  const [resolvedLinkMap, setResolvedLinkMap] = useState<Map<string, any>>(new Map())

  const { masked: maskedContent, restore: restoreCodeBlocks } = useMemo(
    () => maskCodeBlocks(effectiveContent),
    [effectiveContent],
  )

  useEffect(() => {
    const links = parseLinks(maskedContent)
    if (links.length === 0) {
      setResolvedLinkMap(new Map())
      return
    }
    const ids = Array.from(new Set(links.map(l => l.id)))
    resolveLinks(ids).then(setResolvedLinkMap)
  }, [maskedContent])

  useEffect(() => {
    if (!mdFilePath || imageRefs.length === 0) {
      setImageMap({})
      return
    }

    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        imageRefs.map(async (ref) => {
          try {
            const { dataUrl } = await imageApi.readAsDataUrl(mdFilePath, ref, 800)
            return [ref, dataUrl] as const
          } catch {
            return [ref, ''] as const
          }
        })
      )
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const [ref, url] of entries) {
        if (url) map[ref] = url
      }
      setImageMap(map)
    })()

    return () => { cancelled = true }
  }, [mdFilePath, imageRefsKey])

  const renderer = useMemo(() => {
    const r = new marked.Renderer()

    r.code = codeRenderer.code.bind(codeRenderer)

    r.image = function ({ href, title, text }: Tokens.Image) {
      const isLocalAsset = href?.includes('/assets/')
      if (isLocalAsset && imageMap[href]) {
        return `<img src="${imageMap[href]}" alt="${text || ''}" ${title ? `title="${title}"` : ''} style="max-width:100%;border-radius:var(--radius-sm)">`
      }
      if (isLocalAsset && !imageMap[href]) {
        const fileName = href.split('/').pop() || href
        return `<div style="padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:var(--radius-sm);color:var(--text-tertiary);font-size:12px;text-align:center">图片未找到: ${text || fileName}</div>`
      }
      return `<img src="${href || ''}" alt="${text || ''}" ${title ? `title="${title}"` : ''} style="max-width:100%;border-radius:var(--radius-sm)">`
    }

    if (linkTarget === '_blank') {
      r.link = function ({ href, title, text }) {
        const t = title ? ` title="${title}"` : ''
        return `<a href="${href}" target="_blank" rel="noopener noreferrer"${t}>${text}</a>`
      }
    }

    return r
  }, [imageMap, linkTarget])

  const processedContent = useMemo(() => {
    const linkReplaced = resolvedLinkMap.size === 0
      ? maskedContent
      : replaceLinksWithHtml(maskedContent, resolvedLinkMap)
    return restoreCodeBlocks(linkReplaced)
  }, [maskedContent, resolvedLinkMap, restoreCodeBlocks])

  const html = useMemo(() => {
    marked.use({ renderer, gfm: true, breaks: true })
    return marked.parse(escapeRawAngles(processedContent), { async: false }) as string
  }, [processedContent, renderer])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const copyBtn = (e.target as HTMLElement).closest('.code-block__copy') as HTMLButtonElement | null
    if (copyBtn) {
      // 流式中 effectiveContent 滞后,data-code 可能是残缺代码;此时不复制,只提示生成中。
      if (streaming) {
        copyBtn.textContent = '生成中…'
        setTimeout(() => { copyBtn.textContent = '复制' }, 1200)
        return
      }
      const code = copyBtn.dataset.code ?? ''
      const seq = String((Number(copyBtn.dataset.seq ?? 0) + 1))
      copyBtn.dataset.seq = seq
      navigator.clipboard?.writeText(code)
        .then(() => {
          if (copyBtn.dataset.seq !== seq) return
          copyBtn.textContent = '已复制 ✓'
          setTimeout(() => {
            if (copyBtn.dataset.seq !== seq) return
            copyBtn.textContent = '复制'
          }, 1200)
        })
        .catch(() => { /* 权限拒绝/非安全上下文:静默无反馈 */ })
      return
    }
    const target = (e.target as HTMLElement).closest('.wikilink') as HTMLElement | null
    if (!target) return
    const id = target.dataset.linkId
    if (!id) return
    e.preventDefault()
    e.stopPropagation()
    const type = target.dataset.linkType
    if (onLinkClick) {
      onLinkClick(id, type || 'deleted')
    }
  }, [onLinkClick, streaming])

  useEffect(() => {
    const id = 'wikilink-styles'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      .wikilink { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 4px; cursor: pointer; font-size: 0.9em; transition: background 0.15s; }
      .wikilink-plan { background: rgba(96,165,250,0.15); color: #60a5fa; }
      .wikilink-note { background: rgba(192,132,252,0.15); color: #c084fc; }
      .wikilink-deleted { background: rgba(239,68,68,0.12); color: #ef4444; text-decoration: line-through; }
      .wikilink:hover { filter: brightness(1.2); }
    `
    document.head.appendChild(style)
  }, [])

  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  )
}
