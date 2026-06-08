import { describe, expect, it } from 'vitest'
import { classifyDifficulty } from './difficulty'
import type { ScoreInput, ScoreResult } from './types'

const baseInput: ScoreInput = {
  hand: [], winningTile: '1m', melds: [],
  context: {
    seatWind: '南', roundWind: '東', dealer: false, method: 'ron',
    conditions: ['門前'], doraIndicators: ['1m'], ruleNotes: [],
  },
}

function result(partial: Partial<ScoreResult>): ScoreResult {
  return {
    valid: true, yaku: [], han: 2, fu: 30, defen: 2000, fenpei: [],
    isLimit: false, dealer: false, method: 'ron', ...partial,
  }
}

describe('classifyDifficulty', () => {
  it('classifies limit hands', () => {
    expect(classifyDifficulty(result({ isLimit: true, han: 5 }), baseInput)).toBe('limit')
  })

  it('classifies a simple 1-2 han menzen hand as starter', () => {
    const r = result({ han: 2, fu: 30, yaku: [
      { name: '立直', han: 1, isDora: false },
      { name: '平和', han: 1, isDora: false },
    ] })
    expect(classifyDifficulty(r, baseInput)).toBe('starter')
  })

  it('classifies an open kuisagari hand as advanced', () => {
    const input: ScoreInput = {
      ...baseInput,
      melds: [{ kind: 'chi', tiles: ['4p','5p','6p'], open: true, label: '' }],
    }
    const r = result({ han: 3, fu: 30, yaku: [{ name: '混一色', han: 2, isDora: false }] })
    expect(classifyDifficulty(r, input)).toBe('advanced')
  })
})
