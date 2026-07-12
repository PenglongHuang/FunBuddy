/**
 * 主进程日志模块。
 *
 * 输出结构：logs/{YYYY-MM}/{MM-DD}.log
 * 每行格式：[HH:mm:ss.SSS] [LEVEL] <消息>
 * 同步追加写入，失败静默吞掉（日志不引发应用崩溃）。
 * 零新依赖：仅用 Node.js fs/path + Electron app。
 */

import { appendFile, appendFileSync, mkdir, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

type LogLevel = 'INFO' | 'WARN' | 'ERROR'

let _baseDir: string | null = null

function ensureBaseDir(): string {
  if (_baseDir) return _baseDir
  _baseDir = join(app.getPath('userData'), 'funbuddy-workspace', 'logs')
  return _baseDir
}

function logFilePath(now: Date): string {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const day = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return join(ensureBaseDir(), month, `${day}.log`)
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.message}\n${arg.stack ?? '(no stack)'}`
  }
  if (typeof arg === 'string') return arg
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

function write(level: LogLevel, args: unknown[]): void {
  const now = new Date()
  const ts = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join(':')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  const line = `[${ts}.${ms}] [${level}] ${args.map(formatArg).join(' ')}\n`

  // 终端回显（dev 模式可见）
  switch (level) {
    case 'ERROR':
      console.error(line.trimEnd())
      break
    case 'WARN':
      console.warn(line.trimEnd())
      break
    default:
      console.log(line.trimEnd())
  }

  // 文件追加。ERROR 同步落盘(崩溃前的诊断行必须留下);INFO/WARN 维持异步,
  // 不阻塞事件循环。错误一律静默——日志绝不抛。
  const fp = logFilePath(now)
  if (level === 'ERROR') {
    try {
      mkdirSync(dirname(fp), { recursive: true })
      appendFileSync(fp, line, 'utf-8')
    } catch {
      /* 静默 */
    }
  } else {
    mkdir(dirname(fp), { recursive: true }, (err) => {
      if (err) return
      appendFile(fp, line, 'utf-8', () => {})
    })
  }
}

export const logger = {
  info(...args: unknown[]): void {
    write('INFO', args)
  },
  warn(...args: unknown[]): void {
    write('WARN', args)
  },
  error(...args: unknown[]): void {
    write('ERROR', args)
  },
}
