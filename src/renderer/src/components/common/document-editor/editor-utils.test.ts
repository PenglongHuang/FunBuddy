import { describe, expect, it } from 'vitest'
import { hasLinkTrigger, lineIndexToOffset } from './editor-utils'

describe('lineIndexToOffset', () => {
  it('returns the first character offset for a Markdown line', () => {
    expect(lineIndexToOffset('# title\nbody\nlast', 0)).toBe(0)
    expect(lineIndexToOffset('# title\nbody\nlast', 1)).toBe(8)
    expect(lineIndexToOffset('# title\nbody\nlast', 2)).toBe(13)
  })

  it('clamps line indexes outside the document', () => {
    expect(lineIndexToOffset('one\ntwo', -1)).toBe(0)
    expect(lineIndexToOffset('one\ntwo', 99)).toBe(7)
  })
})

describe('hasLinkTrigger', () => {
  it('recognizes @ and [[ triggers at the recorded position', () => {
    expect(hasLinkTrigger('hello @', 6)).toBe(true)
    expect(hasLinkTrigger('hello [[', 6)).toBe(true)
    expect(hasLinkTrigger('hello x', 6)).toBe(false)
  })
})
