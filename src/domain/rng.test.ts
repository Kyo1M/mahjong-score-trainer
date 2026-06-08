import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = [a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })

  it('int(n) returns values in [0, n)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 100; i++) {
      const v = rng.int(5)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(5)
    }
  })

  it('pick returns an element of the array', () => {
    const rng = createRng(1)
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 20; i++) expect(arr).toContain(rng.pick(arr))
  })
})
