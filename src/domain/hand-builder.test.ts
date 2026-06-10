import { describe, expect, it } from 'vitest'
import { buildRandomHand, doraIndicatorFor, countsOk } from './hand-builder'
import { scoreHand } from './majiang-adapter'
import { createRng } from './rng'
import type { ScoreInput, TileCode } from './types'

function allTiles(input: ScoreInput): TileCode[] {
  return [...input.hand, input.winningTile, ...input.melds.flatMap((m) => m.tiles)]
}

function doraOf(ind: TileCode): string {
  const n = Number(ind[0] === '0' ? 5 : ind[0])
  const suit = ind[1]
  if (suit === 'z') {
    if (n <= 4) return `${(n % 4) + 1}z`
    return `${n === 7 ? 5 : n + 1}z`
  }
  return `${n === 9 ? 1 : n + 1}${suit}`
}

describe('buildRandomHand', () => {
  it('yields structurally consistent 14-tile inputs', () => {
    const rng = createRng(42)
    let built = 0
    for (let i = 0; i < 300; i++) {
      const input = buildRandomHand(rng)
      if (!input) continue
      built++
      const tiles = allTiles(input)
      expect(tiles.length, `iter ${i}`).toBe(14)
      expect(countsOk(tiles), `iter ${i}`).toBe(true)
      // 副露ありなら立直・一発なし
      if (input.melds.some((m) => m.open)) {
        expect(input.context.riichi, `iter ${i}`).toBeUndefined()
        expect(input.context.conditions, `iter ${i}`).not.toContain('一発')
      }
      // conditions と method の整合
      if (input.context.method === 'tsumo') {
        expect(input.context.conditions, `iter ${i}`).not.toContain('ロン和了')
      } else {
        expect(input.context.conditions, `iter ${i}`).not.toContain('ツモ和了')
      }
    }
    // 棄却率が高すぎないこと（半分以上は組めている）
    expect(built).toBeGreaterThan(150)
  })

  it('a meaningful share of built hands are engine-valid winning hands', () => {
    const rng = createRng(7)
    let valid = 0
    let attempts = 0
    for (let i = 0; i < 300; i++) {
      const input = buildRandomHand(rng)
      if (!input) continue
      attempts++
      if (scoreHand(input).valid) valid++
    }
    // 全ブロックは完成形なので和了形は常に成立し、役なしだけが invalid になる。
    // 3割以上が valid なら棄却サンプリングとして実用十分。
    expect(attempts).toBeGreaterThan(0)
    expect(valid / attempts).toBeGreaterThan(0.3)
  })

  it('honors suitPool / allowHonors constraints (chinitsu-style)', () => {
    const rng = createRng(99)
    for (let i = 0; i < 100; i++) {
      const input = buildRandomHand(rng, { suitPool: ['p'], allowHonors: false, openMax: 0 })
      if (!input) continue
      for (const t of allTiles(input)) expect(t[1], `iter ${i}: ${t}`).toBe('p')
      expect(input.melds.length, `iter ${i}`).toBe(0)
    }
  })

  it('includes forcedBlocks in the hand (ittsu-style)', () => {
    const rng = createRng(5)
    for (let i = 0; i < 50; i++) {
      const input = buildRandomHand(rng, {
        forcedBlocks: [
          { kind: 'run', suit: 's', start: 1 },
          { kind: 'run', suit: 's', start: 4 },
          { kind: 'run', suit: 's', start: 7 },
        ],
      })
      if (!input) continue
      const counts = new Map<string, number>()
      for (const t of allTiles(input)) counts.set(t, (counts.get(t) ?? 0) + 1)
      for (let n = 1; n <= 9; n++) {
        expect(counts.get(`${n}s`) ?? 0, `iter ${i}: ${n}s`).toBeGreaterThanOrEqual(1)
      }
    }
  })
})

describe('doraIndicatorFor', () => {
  it('returns an indicator that points at exactly N tiles in the hand', () => {
    const rng = createRng(3)
    const hand: TileCode[] = ['2m', '3m', '4m', '3p', '4p', '5p', '4s', '5s', '6s', '7p', '8p', '9p', '2z', '2z']
    for (const want of [0, 1, 2]) {
      const ind = doraIndicatorFor(rng, hand, want)
      if (!ind) continue // その枚数を満たす表示牌が無い場合は null 許容
      const dora = doraOf(ind)
      const count = hand.filter((t) => (t[0] === '0' ? `5${t[1]}` : t) === dora).length
      expect(count, `want ${want}, ind ${ind}`).toBe(want)
    }
    // want=0 は実用上ほぼ常に存在する
    expect(doraIndicatorFor(rng, hand, 0)).not.toBeNull()
  })
})
