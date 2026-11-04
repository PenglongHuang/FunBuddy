import { resolve, sep } from 'path'

/**
 * 渲染器提供的相对路径必须落在 dir 内。
 * 用 base + sep 做前缀校验，避免 /ws 放行 /ws-extended 这类兄弟目录；
 * fullPath === base 不放行（dir 本身是目录，不是可读写文件）。
 */
export function validatePath(dir: string, filePath: string): string {
  const base = resolve(dir)
  const fullPath = resolve(dir, filePath)
  if (!fullPath.startsWith(base + sep)) {
    throw new Error('Invalid path')
  }
  return fullPath
}
