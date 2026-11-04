import { describe, it, expect } from 'vitest'
import { renderMarkdownImage } from '../markdown-image-renderer'

const STYLE = 'max-width:100%;border-radius:var(--radius-sm)'

describe('renderMarkdownImage', () => {
  it('外链图片：href/alt/title 正常输出', () => {
    const out = renderMarkdownImage({ href: 'https://example.com/i.png', title: 'A title', text: 'alt text' }, {})
    expect(out).toBe(`<img src="https://example.com/i.png" alt="alt text" title="A title" style="${STYLE}">`)
  })

  it('title 缺省时不输出 title 属性', () => {
    const out = renderMarkdownImage({ href: 'https://example.com/i.png', title: null, text: 'a' }, {})
    expect(out).toBe(`<img src="https://example.com/i.png" alt="a" style="${STYLE}">`)
  })

  it('href 属性注入被转义，无法逃逸 src 属性', () => {
    const out = renderMarkdownImage({ href: 'x" onmouseover="alert(1)', title: null, text: 'a' }, {})
    expect(out).not.toContain('onmouseover="')
    expect(out).toContain('src="x&quot; onmouseover=&quot;alert(1)"')
  })

  it('alt 注入被转义（审查载荷 a" onerror="alert(1)" src=x）', () => {
    const out = renderMarkdownImage({ href: 'https://e.com/x.png', title: null, text: 'a" onerror="alert(1)" src=x' }, {})
    expect(out).not.toContain('onerror="')
    expect(out).toContain('alt="a&quot; onerror=&quot;alert(1)&quot; src=x"')
  })

  it('title 注入被转义', () => {
    const out = renderMarkdownImage({ href: 'https://e.com/x.png', title: 't" onfocus="alert(2)', text: 'a' }, {})
    expect(out).not.toContain('onfocus="')
    expect(out).toContain('title="t&quot; onfocus=&quot;alert(2)"')
  })

  it('本地资产命中 imageMap 时输出 dataUrl', () => {
    const dataUrl = 'data:image/png;base64,AAA'
    const out = renderMarkdownImage(
      { href: './assets/imgs/x.png', title: null, text: '图' },
      { './assets/imgs/x.png': dataUrl },
    )
    expect(out).toBe(`<img src="${dataUrl}" alt="图" style="${STYLE}">`)
  })

  it('本地资产未命中时输出占位 div，alt 注入同样被转义', () => {
    const out = renderMarkdownImage({ href: './assets/imgs/missing.png', title: null, text: 'a" onerror="alert(1)' }, {})
    expect(out).not.toContain('onerror="')
    expect(out).not.toContain('<img')
    expect(out).toContain('图片未找到: a&quot; onerror=&quot;alert(1)')
  })

  it('本地资产未命中且无 alt 时显示文件名', () => {
    const out = renderMarkdownImage({ href: './assets/imgs/missing.png', title: null, text: '' }, {})
    expect(out).not.toContain('<img')
    expect(out).toContain('missing.png')
  })
})
