import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const stores = [
  fileURLToPath(new URL('../noteStore.ts', import.meta.url)),
  fileURLToPath(new URL('../planStore.ts', import.meta.url)),
]

describe('document store tab integration', () => {
  it.each(stores)('%s delegates tab transitions to the shared reducers', (sourcePath) => {
    const source = readFileSync(sourcePath, 'utf8')

    for (const reducer of [
      'reduceOpenTab',
      'reduceCloseTab',
      'reduceSwitchTab',
      'deactivateTabs',
      'togglePinned',
      'reduceReorderTabs',
      'reduceCloseOtherTabs',
      'reduceCloseUnpinnedTabs',
    ]) {
      expect(source).toContain(`${reducer}(`)
    }

    expect(source).not.toContain('lastUnpinnedIdx')
    expect(source).not.toContain('const pinned = s.tabs.filter')
  })
})
