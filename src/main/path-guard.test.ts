import { describe, it, expect } from 'vitest'
import { validatePath } from './path-guard'

describe('validatePath', () => {
  it('允许工作区内相对路径', () => {
    expect(validatePath('/ws', 'notes/a.md')).toMatch(/notes[\\/]a\.md$/)
  })
  it('拒绝目录穿越', () => {
    expect(() => validatePath('/ws', '../../etc/passwd')).toThrow('Invalid path')
  })
  it('拒绝注入的绝对路径', () => {
    const absolute = process.platform === 'win32' ? 'C:\\Windows\\system32\\x' : '/etc/passwd'
    expect(() => validatePath('/ws', absolute)).toThrow('Invalid path')
  })
  it('拒绝同前缀兄弟目录（startsWith 前缀缺陷）', () => {
    expect(() => validatePath('/ws', '../ws-extended/x')).toThrow('Invalid path')
  })
  it('拒绝解析到工作区本身的路径（dir 是目录不是文件）', () => {
    expect(() => validatePath('/ws', '')).toThrow('Invalid path')
  })
})
