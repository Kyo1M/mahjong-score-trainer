import { describe, expect, it } from 'vitest'
import { generate } from './generator'
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
