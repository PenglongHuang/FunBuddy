import { describe, expect, it } from 'vitest'
import { collectOrphanImages } from './image-cleanup'

// duplicateNote 复制内容但不复制图片文件:副本与原文档引用同一批 basename。
const A_WITH_X = '# 原笔记\n![a](./assets/imgs/20260101-abcd.png)\n'
const B_WITH_X = '# 复制 原笔记\n![b](./assets/imgs/20260101-abcd.png)\n'

describe('collectOrphanImages', () => {
  it('A 引用图 x,B 也引用 x → 删 A 时 x 不删', () => {
    expect(collectOrphanImages(A_WITH_X, [B_WITH_X])).toEqual([])
  })

  it('A 引用图 x,无人再引用 → 删 A 时 x 删', () => {
    expect(collectOrphanImages(A_WITH_X, [])).toEqual(['20260101-abcd.png'])
  })

  it('多张图片只删真正无引用的;跨 category 引用形态同样计入存活集合', () => {
    const a = '![1](./assets/imgs/x1.png)\n![2](./assets/imgs/x2.png)\n![3](./assets/imgs/x3.png)\n'
    const b = '![1](./assets/imgs/x1.png)\n'
    const c = '![3](../plans/assets/imgs/x3.png)\n'
    expect(collectOrphanImages(a, [b, c])).toEqual(['x2.png'])
  })

  it('被删文档无图片引用时返回空', () => {
    expect(collectOrphanImages('# 纯文本', [B_WITH_X])).toEqual([])
  })

  it('非图片扩展名的 assets 引用不删除', () => {
    const a = '![f](./assets/imgs/file.pdf)\n![i](./assets/imgs/ok.jpg)\n'
    expect(collectOrphanImages(a, [])).toEqual(['ok.jpg'])
  })

  it('同一文档重复引用同一图片 → 去重返回单个名字', () => {
    const a = '![1](./assets/imgs/dup.png)\n![2](./assets/imgs/dup.png)\n'
    expect(collectOrphanImages(a, [])).toEqual(['dup.png'])
  })

  it('引用路径含反斜杠段 → 归一化后仍正确提取 basename', () => {
    // 正则锚定字面 `/assets/`;其后的反斜杠段由 replace(/\\/g,'/') 归一,
    // 否则 split('/').pop() 会得到含反斜杠的整段而非真实文件名。
    const a = '![a](./assets/imgs\\sub\\x.png)\n'
    expect(collectOrphanImages(a, [])).toEqual(['x.png'])
  })

  it('alt 含 ] 的存活引用计入存活集合 → 图片不被误删', () => {
    // 编辑器以 ![${altText}](path) 插入,alt 可被编辑含 `]`;
    // 清理端正则对这类引用失明会物理删除仍被引用的图片。
    const survivor = '![caption with ] bracket](./assets/imgs/20260101-abcd.png)\n'
    expect(collectOrphanImages(A_WITH_X, [survivor])).toEqual([])
  })

  it('alt 含 ] 的被删文档引用计入候选 → 孤儿图片仍可删除', () => {
    const a = '![a]b](./assets/imgs/gone.png)\n'
    expect(collectOrphanImages(a, [])).toEqual(['gone.png'])
  })

  it('alt 含 ] 与普通引用混排 → 逐条独立提取互不吞并', () => {
    const a = '![1](./assets/imgs/x1.png)\n![al]t](./assets/imgs/x2.png)\n![3](./assets/imgs/x3.png)\n'
    expect(collectOrphanImages(a, [])).toEqual(['x1.png', 'x2.png', 'x3.png'])
  })
})
