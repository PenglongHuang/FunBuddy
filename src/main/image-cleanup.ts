import { IMAGE_REF_REGEX } from '../shared/image-ref'

/** 图片扩展名白名单(IMAGE_SAVE / IMAGE_PICK_AND_SAVE 生成的文件)。 */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']

function extractImageFileNames(content: string): Set<string> {
  const refs = [...content.matchAll(IMAGE_REF_REGEX)].map((m) => m[1])
  const names = refs.map((ref) => ref.replace(/\\/g, '/').split('/').pop() || '')
  return new Set(names.filter((name) => IMAGE_EXTENSIONS.includes(name.split('.').pop()?.toLowerCase() || '')))
}

/**
 * 计算删除一个 Markdown 文档后可以安全删除的图片文件名。
 *
 * 副本(duplicateNote 复制内容但不复制图片文件)与其他文档可能引用同一批
 * 图片文件,因此只有「被删文档引用、且其余存活文档均不再引用」的图片才是孤儿。
 *
 * @param deletedDocContent 即将被删除的文档内容(在其被删除前读取)
 * @param otherDocContents 其余全部存活 Markdown 文档的内容
 * @returns 可安全 unlink 的图片 basename 列表
 */
export function collectOrphanImages(deletedDocContent: string, otherDocContents: string[]): string[] {
  const candidates = extractImageFileNames(deletedDocContent)
  if (candidates.size === 0) return []
  const stillReferenced = new Set<string>()
  for (const content of otherDocContents) {
    for (const name of extractImageFileNames(content)) stillReferenced.add(name)
  }
  return [...candidates].filter((name) => !stillReferenced.has(name))
}
