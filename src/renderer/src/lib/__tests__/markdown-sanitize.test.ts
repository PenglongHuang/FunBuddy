// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeMarkdownHtml } from '../markdown-sanitize'
import { renderCodeBlock } from '../code-block'
import { buildExportHtml } from '../export-pdf'

function parseFragment(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
  return doc.getElementById('root') as HTMLElement
}

describe('sanitizeMarkdownHtml（MarkdownPreview/export-pdf 共用消毒层）', () => {
  it('中和 <img src=x onerror=alert(1)>：img 保留、on* 事件剥除', () => {
    const root = parseFragment(sanitizeMarkdownHtml('<img src="x" onerror="alert(1)">'))
    const img = root.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('onerror')).toBeNull()
    expect(img?.getAttribute('src')).toBe('x')
  })

  it('保留视频嵌入 iframe（http/https src）', () => {
    const root = parseFragment(
      sanitizeMarkdownHtml('<iframe src="https://www.youtube.com/embed/abc123"></iframe>'),
    )
    const iframe = root.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc123')
  })

  it('剥除 file: 协议的 iframe/img src', () => {
    const out = sanitizeMarkdownHtml(
      '<iframe src="file:///C:/Windows/evil.html"></iframe><img src="file:///C:/x.png" alt="x">',
    )
    expect(out).not.toContain('file:')
    const root = parseFragment(out)
    expect(root.querySelector('iframe')?.getAttribute('src')).toBeNull()
    expect(root.querySelector('img')?.getAttribute('src')).toBeNull()
  })

  it('保留内联图片依赖的 data: URI（DATA_URI_TAGS 默认放行 img）', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
    const root = parseFragment(sanitizeMarkdownHtml(`<img src="${dataUrl}" alt="a">`))
    expect(root.querySelector('img')?.getAttribute('src')).toBe(dataUrl)
  })

  it('wikilink 的 class 与 data-* 完好', () => {
    const wikilink = '<span class="wikilink wikilink-note" data-link-id="abc123" data-link-type="note">📝 标题</span>'
    const root = parseFragment(sanitizeMarkdownHtml(wikilink))
    const span = root.querySelector('span.wikilink') as HTMLElement
    expect(span.className).toBe('wikilink wikilink-note')
    expect(span.dataset.linkId).toBe('abc123')
    expect(span.dataset.linkType).toBe('note')
    expect(span.textContent).toContain('标题')
  })

  it('代码块工具栏的 class 与 data-code 完好', () => {
    const block = renderCodeBlock('js', 'const a = 1', '<span class="hljs-keyword">const</span> a = 1')
    const root = parseFragment(sanitizeMarkdownHtml(block))
    expect(root.querySelector('div.code-block')).not.toBeNull()
    const btn = root.querySelector('button.code-block__copy') as HTMLElement
    expect(btn.dataset.code).toBe('const a = 1')
    expect(root.querySelector('code.hljs.language-js')).not.toBeNull()
  })

  it('链接 target 保留、javascript: href 剥除', () => {
    const root = parseFragment(
      sanitizeMarkdownHtml(
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">ok</a><a href="javascript:alert(1)">bad</a>',
      ),
    )
    const ok = root.querySelectorAll('a')[0]
    expect(ok.getAttribute('target')).toBe('_blank')
    expect(root.querySelectorAll('a')[1].getAttribute('href')).toBeNull()
  })

  it('导出图片依赖的 style 属性保留', () => {
    const root = parseFragment(
      sanitizeMarkdownHtml('<img src="x" alt="a" style="max-width:100%;height:auto">'),
    )
    expect(root.querySelector('img')?.getAttribute('style')).toBe('max-width:100%;height:auto')
  })
})

describe('buildExportHtml（导出姊妹路径同样过消毒）', () => {
  it('导出 HTML 保留 iframe、中和事件属性、保留图片样式', async () => {
    const html = await buildExportHtml({
      content:
        '# 标题\n\n<iframe src="https://www.youtube.com/embed/abc123"></iframe>\n\n<img src=x onerror=alert(1)>\n\n![pic](https://example.com/pic.png)\n',
      mdFilePath: 'notes/n1-t.md',
      title: '导出测试',
      mode: 'title-body',
      fileName: 'export-test',
    })
    expect(html).toContain('<iframe src="https://www.youtube.com/embed/abc123"')
    expect(html).not.toContain('onerror')
    // buildImageRenderer 兜底分支的行内样式不被消毒层剥除
    expect(html).toContain('style="max-width:100%')
    expect(html).toContain('<h1 class="title">导出测试</h1>')
  })
})
