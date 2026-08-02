import { describe, expect, it, vi } from 'vitest'
import {
  appendIndexRecord,
  deleteMarkdownDocument,
  moveMarkdownDocument,
} from './markdown-file-lifecycle'

function fakeIo(initial = '[]') {
  return {
    readFile: vi.fn(async () => initial),
    writeFile: vi.fn(async () => undefined),
    deleteFile: vi.fn(async () => undefined),
  }
}

function fakeAssets() {
  return {
    cleanup: vi.fn(async () => undefined),
    moveAssets: vi.fn(async () => undefined),
  }
}

describe('Markdown file lifecycle', () => {
  it('appends against the latest on-disk index', async () => {
    const io = fakeIo('[{"id":"existing"}]')

    await appendIndexRecord(io, 'plans/index.json', { id: 'new' })

    expect(io.readFile).toHaveBeenCalledWith('plans/index.json')
    expect(io.writeFile).toHaveBeenCalledWith(
      'plans/index.json',
      JSON.stringify([{ id: 'existing' }, { id: 'new' }], null, 2),
    )
  })

  it.each(['not json', '{}', 'null'])(
    'starts a fresh index when the on-disk value is invalid: %s',
    async (initial) => {
      const io = fakeIo(initial)

      await appendIndexRecord(io, 'notes/index.json', { id: 'new' })

      expect(io.writeFile).toHaveBeenCalledWith(
        'notes/index.json',
        JSON.stringify([{ id: 'new' }], null, 2),
      )
    },
  )

  it('cleans assets before deleting Markdown and tolerates both failures', async () => {
    const events: string[] = []
    const io = fakeIo()
    const assets = fakeAssets()
    assets.cleanup.mockImplementation(async () => {
      events.push('cleanup')
      throw new Error('assets missing')
    })
    io.deleteFile.mockImplementation(async () => {
      events.push('delete')
      throw new Error('file missing')
    })

    await expect(deleteMarkdownDocument(io, assets, 'notes/a.md')).resolves.toBeUndefined()

    expect(events).toEqual(['cleanup', 'delete'])
    expect(assets.cleanup).toHaveBeenCalledWith('notes/a.md')
    expect(io.deleteFile).toHaveBeenCalledWith('notes/a.md')
  })

  it('copies content, deletes the old file, then moves assets', async () => {
    const events: string[] = []
    const io = fakeIo('# body')
    const assets = fakeAssets()
    io.readFile.mockImplementation(async () => {
      events.push('read')
      return '# body'
    })
    io.writeFile.mockImplementation(async () => {
      events.push('write')
    })
    io.deleteFile.mockImplementation(async () => {
      events.push('delete')
    })
    assets.moveAssets.mockImplementation(async () => {
      events.push('assets')
    })

    await moveMarkdownDocument(io, assets, 'notes/old.md', 'notes/new.md')

    expect(events).toEqual(['read', 'write', 'delete', 'assets'])
    expect(io.writeFile).toHaveBeenCalledWith('notes/new.md', '# body')
    expect(io.deleteFile).toHaveBeenCalledWith('notes/old.md')
    expect(assets.moveAssets).toHaveBeenCalledWith('notes/old.md', 'notes/new.md')
  })

  it('does nothing when moving to the same path', async () => {
    const io = fakeIo('# body')
    const assets = fakeAssets()

    await moveMarkdownDocument(io, assets, 'notes/a.md', 'notes/a.md')

    expect(io.readFile).not.toHaveBeenCalled()
    expect(io.writeFile).not.toHaveBeenCalled()
    expect(io.deleteFile).not.toHaveBeenCalled()
    expect(assets.moveAssets).not.toHaveBeenCalled()
  })

  it('still moves assets when deleting the old Markdown file fails', async () => {
    const io = fakeIo('# body')
    const assets = fakeAssets()
    io.deleteFile.mockRejectedValue(new Error('old file missing'))

    await expect(
      moveMarkdownDocument(io, assets, 'notes/old.md', 'notes/new.md'),
    ).resolves.toBeUndefined()

    expect(assets.moveAssets).toHaveBeenCalledWith('notes/old.md', 'notes/new.md')
  })

  it('tolerates asset move failure after the file has been copied', async () => {
    const io = fakeIo('# body')
    const assets = fakeAssets()
    assets.moveAssets.mockRejectedValue(new Error('assets missing'))

    await expect(
      moveMarkdownDocument(io, assets, 'notes/old.md', 'notes/new.md'),
    ).resolves.toBeUndefined()

    expect(io.writeFile).toHaveBeenCalledWith('notes/new.md', '# body')
    expect(io.deleteFile).toHaveBeenCalledWith('notes/old.md')
  })

  it('does not delete the old file when writing the new file fails', async () => {
    const io = fakeIo('# body')
    const assets = fakeAssets()
    io.writeFile.mockRejectedValue(new Error('disk full'))

    await expect(
      moveMarkdownDocument(io, assets, 'notes/old.md', 'notes/new.md'),
    ).rejects.toThrow('disk full')

    expect(io.deleteFile).not.toHaveBeenCalled()
    expect(assets.moveAssets).not.toHaveBeenCalled()
  })
})
