import { extname } from 'path'

/**
 * 渲染端不得经 STORE_SET 直写的特权键：这些键直接决定主进程的文件系统边界
 * （storageDir 决定全部 FS_* 通道的根；storageDirHistory 是 STORE_SET_STORAGE_DIR
 * 的合法路径来源之一）。工作区切换必须走 STORE_SET_STORAGE_DIR 令牌通道。
 *
 * 除键本身外，祖先键（如一次 set('settings', {...}) 整体覆写会连带写入受保护
 * 子键）与后代键（篡改值形态，如把 storageDir 改写成对象）同样拒绝。
 */
export const PRIVILEGED_STORE_KEYS = ['settings.storageDir', 'settings.storageDirHistory']

export function isPrivilegedStoreKey(key: string): boolean {
  return PRIVILEGED_STORE_KEYS.some(
    (privileged) =>
      key === privileged ||
      key.startsWith(privileged + '.') ||
      privileged.startsWith(key + '.'),
  )
}

export function assertNonPrivilegedStoreKey(key: string): void {
  if (isPrivilegedStoreKey(key)) {
    throw new Error(`Renderer must not write privileged store key: ${key}`)
  }
}

/**
 * FS_WRITE_FILE 允许落盘的扩展名白名单。
 * 纵深防御：即使渲染器受损，也最多在工作区内写 Markdown 文档与索引，
 * 不能借工作区切换 + 任意写入把可执行文件放进开机自启动等敏感目录。
 */
export const WRITABLE_FILE_EXTENSIONS = ['.md', '.json']

export function isWritableFilePath(fullPath: string): boolean {
  return WRITABLE_FILE_EXTENSIONS.includes(extname(fullPath).toLowerCase())
}

export function assertWritableExtension(fullPath: string): void {
  if (!isWritableFilePath(fullPath)) {
    throw new Error(`Only ${WRITABLE_FILE_EXTENSIONS.join('/')} files are writable: ${fullPath}`)
  }
}
