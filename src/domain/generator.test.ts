import { describe, expect, it } from 'vitest'
import { generate, yakuSignature, __themesForTest } from './generator'
import { scoreHand } from './majiang-adapter'
import { classifyDifficulty } from './difficulty'
import { mapYakuName } from './yaku-map'
import { createRng } from './rng'
import type { TileCode } from './types'

function tileCounts(tiles: TileCode[]): Map<string, number> {
  const norm = (t: TileCode) => (t[0] === '0' ? `5${t[1]}` : t)
  const m = new Map<string, number>()
  for (const t of tiles) m.set(norm(t), (m.get(norm(t)) ?? 0) + 1)
  return m
}

describe('generate (property tests)', () => {
  it('always yields a valid, consistent, 14-tile hand', () => {
    const rng = createRng(12345)
    for (let i = 0; i < 200; i++) {
      const { input, result } = generate('mix', rng)
      const all = [
        ...input.hand, input.winningTile, ...input.melds.flatMap((m) => m.tiles),
      ]
      expect(all.length, `iter ${i}`).toBe(14)
      for (const [t, c] of tileCounts(all)) expect(c, `${i}:${t}`).toBeLessThanOrEqual(4)
      expect(result.valid, `iter ${i}`).toBe(true)

      const open = input.melds.some((m) => m.open)
      const names = result.yaku.map((y) => y.name)
      if (open) {
        expect(names, `iter ${i}`).not.toContain('立直')
        expect(names, `iter ${i}`).not.toContain('門前清自摸和')
        expect(names, `iter ${i}`).not.toContain('一発')
      }
      if (names.includes('一発')) expect(names.some((n) => n.includes('立直')), `iter ${i}`).toBe(true)

      // every non-dora yaku must map to our catalog (else it would be silently dropped downstream)
      for (const y of result.yaku) {
        if (y.isDora) continue
        expect(mapYakuName(y.name), `iter ${i}: ${y.name}`).not.toBeNull()
      }

      // re-scoring the same input is deterministic
      const again = scoreHand(input)
      expect(again.defen, `iter ${i}`).toBe(result.defen)

      // context.conditions must not contradict context.method (no ツモ手 showing ロン和了, etc.)
      const conds = input.context.conditions
      if (input.context.method === 'tsumo') {
        expect(conds, `iter ${i}`).not.toContain('ロン和了')
      } else {
        expect(conds, `iter ${i}`).not.toContain('ツモ和了')
      }
    }
  })

  it('respects the requested difficulty filter', () => {
    const rng = createRng(999)
    for (const filter of ['starter', 'standard', 'advanced', 'limit'] as const) {
      for (let i = 0; i < 30; i++) {
        const { input, result } = generate(filter, rng)
        expect(classifyDifficulty(result, input), `${filter}:${i}`).toBe(filter)
      }
    }
  })
})

describe('generate (variety)', () => {
  it('mix yields at least 10 distinct yaku kinds across 200 questions', () => {
    const rng = createRng(2026)
    const kinds = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const { result } = generate('mix', rng)
      for (const y of result.yaku) {
        if (!y.isDora) kinds.add(mapYakuName(y.name)!.key)
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(10)
  })

  it('mix yields some 50fu+ questions below mangan (fu drills)', () => {
    const rng = createRng(777)
    let highFu = 0
    for (let i = 0; i < 200; i++) {
      const { result } = generate('mix', rng)
      if (!result.isLimit && (result.fu ?? 0) >= 50) highFu++
    }
    expect(highFu).toBeGreaterThan(0)
  })

  it('fu drill builds land between 50 and 70 fu when accepted', () => {
    const rng = createRng(4242)
    let accepted = 0
    for (let i = 0; i < 300 && accepted < 20; i++) {
      const input = __themesForTest.fuDrill.build(rng)
      if (!input) continue
      const result = scoreHand(input)
      if (!result.valid || result.isLimit || (result.fu ?? 0) < 50) continue
      accepted++
      expect(result.fu, `iter ${i}`).toBeLessThanOrEqual(70)
    }
    expect(accepted).toBeGreaterThan(0)
  })

  it('avoid signatures suppress immediate repeats (best effort)', () => {
    const rng = createRng(31337)
    let prev = ''
    let repeats = 0
    for (let i = 0; i < 100; i++) {
      const { result } = generate('mix', rng, { avoid: prev ? [prev] : [] })
      const sig = yakuSignature(result)
      if (sig === prev) repeats++
      prev = sig
    }
    // フォールバックパスはガードを無視するので 0 とは限らないが、ほぼ抑止される
    expect(repeats).toBeLessThanOrEqual(2)
  })
})
