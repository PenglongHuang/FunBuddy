import { getStore } from '../store'
import { claudeCodeProvider } from './claude-code'
import type { CodingAgentProvider } from './types'

/**
 * 已注册的 Coding Agent。新增 provider 时在此登记即可。
 * 目前只有 Claude Code;后续接入其它 agent 在此加一条。
 */
const providers: Record<string, CodingAgentProvider> = {
  'claude-code': claudeCodeProvider,
}

/** 列出所有已注册 provider(供设置页枚举)。 */
export function listProviders(): CodingAgentProvider[] {
  return Object.values(providers)
}

/**
 * 取当前绑定的 provider。读取 settings.ai.provider(默认 'claude-code');
 * 若配置指向未注册的 id,回退到 Claude Code,绝不抛错。
 */
export function getActiveProvider(): CodingAgentProvider {
  const configured = getStore().get('settings').ai?.provider ?? 'claude-code'
  return providers[configured] ?? claudeCodeProvider
}
