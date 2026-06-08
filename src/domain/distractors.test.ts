import { describe, expect, it } from 'vitest'
import { hanChoices, paymentChoice, paymentDistractors } from './distractors'
import { createRng } from './rng'
import type { ScoreResult } from './types'

const base: ScoreResult = {
  valid: true, yaku: [], han: 3, fu: 30, defen: 3900,
  fenpei: [-3900, 3900, 0, 0], isLimit: false, dealer: false, method: 'ron',
}

describe('distractors', () => {
  it('han choices include the correct han and total 4 unique options', () => {
    const choices = hanChoices(base, createRng(1))
    expect(choices).toHaveLength(4)
    expect(choices.map((c) => c.key)).toContain('3')
    expect(new Set(choices.map((c) => c.key)).size).toBe(4)
  })

  it('payment choices include the correct payment and 3 distinct distractors', () => {
    const correct = paymentChoice(base)
    const all = paymentDistractors(base, createRng(2))
    expect(all.map((c) => c.key)).toContain(correct.key)
    expect(all).toHaveLength(4)
    expect(new Set(all.map((c) => c.key)).size).toBe(4)
  })

  it('formats a child tsumo as "ko / oya"', () => {
    const tsumo: ScoreResult = { ...base, method: 'tsumo', defen: 5200, fenpei: [-2600, 5200, -1300, -1300] }
    expect(paymentChoice(tsumo).label).toBe('1300 / 2600点')
  })
})
