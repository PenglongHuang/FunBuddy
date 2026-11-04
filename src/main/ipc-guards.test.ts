import { describe, it, expect } from 'vitest'
import {
  PRIVILEGED_STORE_KEYS,
  WRITABLE_FILE_EXTENSIONS,
  assertNonPrivilegedStoreKey,
  assertWritableExtension,
  isPrivilegedStoreKey,
  isWritableFilePath,
} from './ipc-guards'

describe('assertNonPrivilegedStoreKey', () => {
  it.each(PRIVILEGED_STORE_KEYS)('拒绝特权键 %s', (key) => {
    expect(() => assertNonPrivilegedStoreKey(key)).toThrow(/privileged store key/)
  })

  it('拒绝祖先键（整体覆写会连带写入受保护子键）', () => {
    expect(() => assertNonPrivilegedStoreKey('settings')).toThrow(/privileged store key/)
  })

  it('拒绝后代键（篡改特权键的值形态）', () => {
    expect(() => assertNonPrivilegedStoreKey('settings.storageDir.child')).toThrow(/privileged store key/)
  })

  it('放行普通设置键', () => {
    expect(() => assertNonPrivilegedStoreKey('settings.app')).not.toThrow()
    expect(() => assertNonPrivilegedStoreKey('settings.pomodoro')).not.toThrow()
    expect(() => assertNonPrivilegedStoreKey('timer')).not.toThrow()
    expect(() => assertNonPrivilegedStoreKey('timerHistory')).not.toThrow()
  })

  it('前缀相似的键不受误伤', () => {
    expect(isPrivilegedStoreKey('settings.storageDirHint')).toBe(false)
    expect(isPrivilegedStoreKey('settings.storage')).toBe(false)
  })
})

describe('assertWritableExtension', () => {
  it.each(WRITABLE_FILE_EXTENSIONS)('允许 %s', (ext) => {
    const fullPath = process.platform === 'win32' ? `C:\\ws\\notes\\a${ext}` : `/ws/notes/a${ext}`
    expect(isWritableFilePath(fullPath)).toBe(true)
    expect(() => assertWritableExtension(fullPath)).not.toThrow()
  })

  it('扩展名大小写不敏感', () => {
    expect(isWritableFilePath('/ws/notes/A.MD')).toBe(true)
    expect(isWritableFilePath('/ws/notes/Index.JSON')).toBe(true)
  })

  it.each(['.exe', '.bat', '.cmd', '.html', '.js', '.pdf'])('拒绝 %s', (ext) => {
    expect(() => assertWritableExtension(`/ws/notes/a${ext}`)).toThrow(/Only \.md\/\.json/)
  })

  it('拒绝无扩展名与尾随空格伪装', () => {
    expect(() => assertWritableExtension('/ws/notes/file')).toThrow()
    expect(() => assertWritableExtension('/ws/notes/a.md ')).toThrow()
    expect(() => assertWritableExtension('/ws/notes/.gitignore')).toThrow()
  })
})
