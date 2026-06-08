import { describe, expect, it } from 'vitest'
import { practiceQuestions } from './questions'
import { calculateStats, evaluateAnswer } from './scoring'
import type { TileCode } from './types'

function normalizedTile(tile: TileCode): string {
  if (tile === '0m') {
    return '5m'
  }
  if (tile === '0p') {
    return '5p'
  }
  if (tile === '0s') {
    return '5s'
  }

  return tile
}

function allTiles(question: (typeof practiceQuestions)[number]): TileCode[] {
  return [
    ...question.hand,
    question.winningTile,
    ...question.melds.flatMap((meld) => meld.tiles),
  ]
}

describe('practiceQuestions', () => {
  it('contains physically valid tile counts', () => {
    for (const question of practiceQuestions) {
      const counts = new Map<string, number>()

      for (const tile of allTiles(question)) {
        const key = normalizedTile(tile)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }

      expect(allTiles(question).length, question.id).toBe(14)
      for (const [tile, count] of counts) {
        expect(count, `${question.id}: ${tile}`).toBeLessThanOrEqual(4)
      }
    }
  })

  it('keeps canonical answers selectable', () => {
    for (const question of practiceQuestions) {
      const yakuKeys = question.options.yaku.map((choice) => choice.key)
      const hanKeys = question.options.han.map((choice) => choice.key)
      const fuKeys = question.options.fu.map((choice) => choice.key)
      const paymentKeys = question.options.payment.map((choice) => choice.key)

      for (const yakuKey of question.canonicalInterpretation.yakuKeys) {
        expect(yakuKeys, `${question.id}: ${yakuKey}`).toContain(yakuKey)
      }
      expect(hanKeys, question.id).toContain(question.canonicalInterpretation.hanKey)
      expect(fuKeys, question.id).toContain(question.canonicalInterpretation.fuKey)
      expect(paymentKeys, question.id).toContain(
        question.canonicalInterpretation.paymentKey,
      )
    }
  })
})

describe('evaluateAnswer', () => {
  it('accepts the canonical answer for every vetted question', () => {
    for (const question of practiceQuestions) {
      const evaluation = evaluateAnswer(question, {
        yakuKeys: question.canonicalInterpretation.yakuKeys,
        hanKey: question.canonicalInterpretation.hanKey,
        fuKey: question.canonicalInterpretation.fuKey,
        paymentKey: question.canonicalInterpretation.paymentKey,
      })

      expect(evaluation.completeCorrect, question.id).toBe(true)
      expect(evaluation.yakuCorrect, question.id).toBe(true)
      expect(evaluation.hanCorrect, question.id).toBe(true)
      expect(evaluation.fuCorrect, question.id).toBe(true)
      expect(evaluation.paymentCorrect, question.id).toBe(true)
    }
  })

  it('does not require fu for limit hands', () => {
    const question = practiceQuestions.find(
      (candidate) => candidate.id === 'q-mangan-child-tsumo',
    )

    expect(question).toBeDefined()

    const evaluation = evaluateAnswer(question!, {
      yakuKeys: question!.canonicalInterpretation.yakuKeys,
      hanKey: question!.canonicalInterpretation.hanKey,
      fuKey: 'not-needed',
      paymentKey: question!.canonicalInterpretation.paymentKey,
    })

    expect(evaluation.completeCorrect).toBe(true)
    expect(evaluation.fuCorrect).toBe(true)
  })

  it('tracks partial correctness separately', () => {
    const question = practiceQuestions[0]
    const evaluation = evaluateAnswer(question, {
      yakuKeys: question.canonicalInterpretation.yakuKeys,
      hanKey: question.canonicalInterpretation.hanKey,
      fuKey: '40',
      paymentKey: 'child-ron-3900',
    })

    expect(evaluation.completeCorrect).toBe(false)
    expect(evaluation.yakuCorrect).toBe(true)
    expect(evaluation.hanCorrect).toBe(true)
    expect(evaluation.fuCorrect).toBe(false)
    expect(evaluation.paymentCorrect).toBe(false)
  })

  it('accepts yaku selections independent of order', () => {
    const question = practiceQuestions[0]
    const evaluation = evaluateAnswer(question, {
      yakuKeys: [...question.canonicalInterpretation.yakuKeys].reverse(),
      hanKey: question.canonicalInterpretation.hanKey,
      fuKey: question.canonicalInterpretation.fuKey,
      paymentKey: question.canonicalInterpretation.paymentKey,
    })

    expect(evaluation.completeCorrect).toBe(true)
    expect(evaluation.yakuCorrect).toBe(true)
  })
})

describe('calculateStats', () => {
  it('summarizes completed questions including fu denominator only when required', () => {
    const regular = practiceQuestions[0]
    const limit = practiceQuestions.find(
      (question) => question.id === 'q-mangan-child-tsumo',
    )!
    const completed = [
      {
        questionId: regular.id,
        fuRequired: true,
        evaluation: evaluateAnswer(regular, {
          yakuKeys: regular.canonicalInterpretation.yakuKeys,
          hanKey: regular.canonicalInterpretation.hanKey,
          fuKey: regular.canonicalInterpretation.fuKey,
          paymentKey: regular.canonicalInterpretation.paymentKey,
        }),
        elapsedMs: 4000,
        answeredAt: new Date().toISOString(),
      },
      {
        questionId: limit.id,
        fuRequired: false,
        evaluation: evaluateAnswer(limit, {
          yakuKeys: limit.canonicalInterpretation.yakuKeys,
          hanKey: '4',
          fuKey: 'not-needed',
          paymentKey: limit.canonicalInterpretation.paymentKey,
        }),
        elapsedMs: 6000,
        answeredAt: new Date().toISOString(),
      },
    ]

    const stats = calculateStats(completed)

    expect(stats.total).toBe(2)
    expect(stats.completeCorrect).toBe(1)
    expect(stats.completeRate).toBe(0.5)
    expect(stats.yakuRate).toBe(1)
    expect(stats.fuRate).toBe(1)
    expect(stats.averageSeconds).toBe(5)
  })
})
