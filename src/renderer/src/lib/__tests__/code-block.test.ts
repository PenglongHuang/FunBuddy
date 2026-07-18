import { describe, it, expect } from 'vitest'
import { renderCodeBlock } from '../code-block'

describe('renderCodeBlock', () => {
  it('输出含语言标签、复制按钮、高亮内容', () => {
    const html = renderCodeBlock('ts', 'const x = 1', '<span>const</span>')
    expect(html).toContain('class="code-block"')
    expect(html).toContain('class="code-block__lang">ts<')
    expect(html).toContain('class="code-block__copy"')
    expect(html).toContain('<span>const</span>')
  })

  it('data-code 存 HTML 转义后的原文', () => {
    const html = renderCodeBlock('ts', 'a < b & "c"', 'x')
    expect(html).toContain('data-code="a &lt; b &amp; &quot;c&quot;"')
  })

  it('无 lang 时语言标签回退为 text', () => {
    const html = renderCodeBlock(undefined, 'hi', 'hi')
    expect(html).toContain('class="code-block__lang">text<')
    expect(html).toContain('language-text')
  })

  it('恶意 lang 被转义,无法注入标签或逃逸属性', () => {
    const html = renderCodeBlock('"><img onerror=alert(1)>', 'x', 'x')
    // label span 与 class 属性里的引号/尖括号都必须被转义
    expect(html).not.toContain('"><img')
    expect(html).toContain('&quot;&gt;&lt;img onerror=alert(1)&gt;')
  })
})
