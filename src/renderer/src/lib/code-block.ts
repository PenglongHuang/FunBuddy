/** HTML 属性值转义:data-code 存进去后,读 el.dataset.code 时浏览器自动反转义回原文。 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 渲染带「语言标签 + 复制按钮」工具栏的代码块 HTML。
 * - rawCode:代码原文(转义后存进 data-code,供复制)
 * - highlighted:已高亮(或转义)的 HTML 串,放进 <code>
 */
export function renderCodeBlock(
  lang: string | undefined,
  rawCode: string,
  highlighted: string,
): string {
  const label = lang && lang.trim() ? lang.trim() : 'text'
  const escLabel = escapeHtml(label)
  return (
    `<div class="code-block">` +
    `<div class="code-block__bar">` +
    `<span class="code-block__lang">${escLabel}</span>` +
    `<button type="button" class="code-block__copy" aria-label="复制代码" data-code="${escapeHtml(rawCode)}">复制</button>` +
    `</div>` +
    `<pre><code class="hljs language-${escLabel}">${highlighted}</code></pre>` +
    `</div>`
  )
}
