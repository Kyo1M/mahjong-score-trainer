import { describe, expect, it } from 'vitest'
import { practiceQuestions } from './questions'
import { scoreHand } from './majiang-adapter'
import { mapYakuName } from './yaku-map'

describe('golden: engine vs existing questions', () => {
  it('produces a valid, internally consistent score for every hand', () => {
    for (const q of practiceQuestions) {
      if (q.difficulty === 'limit' && q.id.includes('kokushi')) continue
      const r = scoreHand({
        hand: q.hand, winningTile: q.winningTile, melds: q.melds, context: q.context,
      })
      expect(r.valid, q.id).toBe(true)
      expect(r.han, q.id).toBe(r.yaku.reduce((s, y) => s + y.han, 0))
      for (const y of r.yaku) {
        if (y.isDora) continue
        expect(mapYakuName(y.name), `${q.id}: ${y.name}`).not.toBeNull()
      }
    }
  })

  it('reconciles known discrepancies in the original fixtures', () => {
    const q1 = practiceQuestions.find((q) => q.id === 'q-pinfu-ron-30-4-child')!
    const r1 = scoreHand({ hand: q1.hand, winningTile: q1.winningTile, melds: q1.melds, context: q1.context })
    expect(r1.han).toBe(4)
    // 標準ルール（切り上げ満貫なし）では 30符4翻 は満貫未満の 7700 点。
    expect(r1.isLimit).toBe(false)
    expect(r1.defen).toBe(7700)

    const q3 = practiceQuestions.find((q) => q.id === 'q-chiitoi-ron-25-4-child')!
    const r3 = scoreHand({ hand: q3.hand, winningTile: q3.winningTile, melds: q3.melds, context: q3.context })
    expect(r3.han).toBe(5)
    expect(r3.isLimit).toBe(true)
    expect(r3.defen).toBe(8000)
  })
})
