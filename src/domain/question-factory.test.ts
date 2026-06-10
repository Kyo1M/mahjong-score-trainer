import { describe, expect, it } from 'vitest'
import { buildQuestion } from './question-factory'
import { evaluateAnswer } from './scoring'
import { generate } from './generator'
import { createRng } from './rng'
import { yakuCatalog } from './yaku-map'
import type { ScoreInput, ScoreResult } from './types'

describe('buildQuestion', () => {
  it('produces a question whose canonical answer is selectable and complete-correct', () => {
    const rng = createRng(2024)
    for (let i = 0; i < 100; i++) {
      const { input, result } = generate('mix', rng)
      const q = buildQuestion(input, result, rng)

      const yakuKeys = q.options.yaku.map((c) => c.key)
      for (const k of q.canonicalInterpretation.yakuKeys) expect(yakuKeys, q.id).toContain(k)
      expect(q.options.han.map((c) => c.key), q.id).toContain(q.canonicalInterpretation.hanKey)
      expect(q.options.payment.map((c) => c.key), q.id).toContain(q.canonicalInterpretation.paymentKey)
      if (q.fuRequired) {
        expect(q.options.fu.map((c) => c.key), q.id).toContain(q.canonicalInterpretation.fuKey)
      }

      const evalResult = evaluateAnswer(q, {
        yakuKeys: q.canonicalInterpretation.yakuKeys,
        hanKey: q.canonicalInterpretation.hanKey,
        fuKey: q.canonicalInterpretation.fuKey,
        paymentKey: q.canonicalInterpretation.paymentKey,
      })
      expect(evalResult.completeCorrect, q.id).toBe(true)
    }
  })

  it('always exposes the canonical fu as a selectable option for fuRequired questions', () => {
    const rng = createRng(7)
    let fuRequiredSeen = 0
    for (let i = 0; i < 200; i++) {
      const { input, result } = generate('mix', rng)
      const q = buildQuestion(input, result, rng)
      if (!q.fuRequired) continue
      fuRequiredSeen++
      const fuKeys = q.options.fu.map((c) => c.key)
      // The canonical fu must be selectable even when it falls outside the fixed
      // menu (e.g. 80+ fu toitoi/sanankou shapes still below mangan).
      expect(fuKeys, q.id).toContain(q.canonicalInterpretation.fuKey)
      expect(q.canonicalInterpretation.fuKey, q.id).toBe(String(result.fu))
    }
    expect(fuRequiredSeen).toBeGreaterThan(0)
  })

  it('title and prompt never leak yaku names', () => {
    const rng = createRng(555)
    const allYakuLabels = Object.values(yakuCatalog).map((c) => c.label)
    for (let i = 0; i < 100; i++) {
      const { input, result } = generate('mix', rng)
      const q = buildQuestion(input, result, rng)
      expect(q.title, q.id).toMatch(/^(親|子)の(ロン|ツモ)和了$/)
      for (const label of allYakuLabels) {
        expect(q.title, q.id).not.toContain(label)
        expect(q.prompt, q.id).not.toContain(label)
      }
    }
  })

  it('inserts an out-of-menu fu value so it stays selectable and complete-correct', () => {
    const rng = createRng(99)
    // A high-fu toitoi/sanankou shape (80符, 3翻) still below mangan: 80 is not in
    // the fixed fu menu, so the factory must inject it.
    const input: ScoreInput = {
      hand: ['2m', '2m', '2m', '5p', '5p', '5p', '8s', '8s', '8s', '3s', '3s', '3s', '7m'],
      winningTile: '7m',
      melds: [],
      context: {
        seatWind: '南',
        roundWind: '東',
        dealer: false,
        method: 'ron',
        conditions: ['門前', 'ロン和了'],
        doraIndicators: ['1z'],
        ruleNotes: [],
      },
    }
    const result: ScoreResult = {
      valid: true,
      yaku: [
        { name: '対々和', han: 2, isDora: false },
        { name: '三暗刻', han: 1, isDora: false },
      ],
      han: 3,
      fu: 80,
      fuDetail: null,
      defen: 7700,
      fenpei: [7700, -7700],
      isLimit: false,
      dealer: false,
      method: 'ron',
    }

    const q = buildQuestion(input, result, rng)
    expect(q.fuRequired).toBe(true)
    expect(q.canonicalInterpretation.fuKey).toBe('80')
    const fuKeys = q.options.fu.map((c) => c.key)
    expect(fuKeys).toContain('80')
    // The injected entry must precede `not-needed` and not displace it.
    expect(fuKeys.indexOf('80')).toBeLessThan(fuKeys.indexOf('not-needed'))
    expect(fuKeys).toContain('not-needed')

    const evalResult = evaluateAnswer(q, {
      yakuKeys: q.canonicalInterpretation.yakuKeys,
      hanKey: q.canonicalInterpretation.hanKey,
      fuKey: q.canonicalInterpretation.fuKey,
      paymentKey: q.canonicalInterpretation.paymentKey,
    })
    expect(evalResult.completeCorrect).toBe(true)
  })
})
