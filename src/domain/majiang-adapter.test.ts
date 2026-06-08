import { describe, expect, it } from 'vitest'
import Majiang from '@kobalab/majiang-core'

/**
 * Task 0 spike: empirically pin down the real @kobalab/majiang-core API so
 * later tasks can rely on it. These assertions exercise the genuine library.
 *
 * Confirmed conventions:
 * - Import: `import Majiang from '@kobalab/majiang-core'`, then destructure.
 * - `param` MUST be normalized via `Util.hule_param(...)`; passing a flat
 *   object straight to `Util.hule` throws (it reads `param.hupai`/`param.jicun`).
 * - Tsumo: attach the winning tile with `shoupai.zimo('m4')`, pass `rongpai = null`.
 * - Ron: `rongpai` needs a direction marker, e.g. 'm4=' (対面). No marker throws.
 * - No-yaku (役なし): `hule` returns `{ defen: 0 }` (no `hupai`/`fu`/`fanshu`).
 */
describe('majiang-core spike', () => {
  const { Shoupai, Util, rule } = Majiang

  it('scores a known pinfu tsumo', () => {
    const shoupai = Shoupai.fromString('z33m123p456s789m23').zimo('m4')
    const param = Util.hule_param({ rule: rule(), zhuangfeng: 0, menfeng: 1 })
    const r = Util.hule(shoupai, null, param)

    const names = r.hupai?.map((y) => y.name)
    expect(names).toContain('平和')
    expect(names).toContain('門前清自摸和')
    expect(r.fu).toBe(20)
    expect(r.fanshu).toBe(2)
    expect(r.defen).toBe(1500)
  })

  it('scores a menzen pinfu ron (direction marker required)', () => {
    // 13-tile hand (no zimo); win on m4 from 対面 ('=').
    const shoupai = Shoupai.fromString('z33m123p456s789m23')
    const param = Util.hule_param({ rule: rule(), zhuangfeng: 0, menfeng: 1 })
    const r = Util.hule(shoupai, 'm4=', param)

    expect(r.hupai?.map((y) => y.name)).toContain('平和')
    expect(r.fu).toBe(30)
    expect(r.fanshu).toBe(1)
    expect(r.defen).toBe(1000)
  })

  it('throws on a ron tile without a direction marker', () => {
    const shoupai = Shoupai.fromString('z33m123p456s789m23')
    const param = Util.hule_param({ rule: rule(), zhuangfeng: 0, menfeng: 1 })
    expect(() => Util.hule(shoupai, 'm4', param)).toThrow()
  })

  it('returns { defen: 0 } for a hand with no yaku (役なし)', () => {
    // Open hand (chi p678) of simples with クイタン disabled => no yaku.
    const shoupai = Shoupai.fromString('m234p567s23m99,p678-')
    const param = Util.hule_param({
      rule: rule({ クイタンあり: false }),
      zhuangfeng: 0,
      menfeng: 1,
    })
    const r = Util.hule(shoupai, 's4=', param)

    expect(r.defen).toBe(0)
    expect(r.hupai).toBeUndefined()
    expect(r.fu).toBeUndefined()
    expect(r.fanshu).toBeUndefined()
  })

  it('reports yakuman via damanguan with string fanshu', () => {
    const shoupai = Shoupai.fromString('m111p333s555z111m9').zimo('m9')
    const param = Util.hule_param({ rule: rule(), zhuangfeng: 0, menfeng: 1 })
    const r = Util.hule(shoupai, null, param)

    expect(r.hupai?.[0].name).toBe('四暗刻単騎')
    expect(r.hupai?.[0].fanshu).toBe('**')
    expect(r.damanguan).toBe(2)
    expect(r.defen).toBe(64000)
  })

  it('passes flat param fields (lizhi/yifa/baopai) through hule_param', () => {
    const shoupai = Shoupai.fromString('z33m123p456s789m23*').zimo('m4')
    const param = Util.hule_param({
      rule: rule(),
      zhuangfeng: 0,
      menfeng: 1,
      lizhi: 1,
      yifa: true,
      baopai: ['m1'],
    })
    const r = Util.hule(shoupai, null, param)

    const names = r.hupai?.map((y) => y.name)
    expect(names).toContain('立直')
    expect(names).toContain('一発')
    expect(names).toContain('ドラ')
  })

  it('merges rule overrides without throwing', () => {
    const merged = rule({ 数え役満あり: false })
    expect(merged['数え役満あり']).toBe(false)
    // a non-overridden default is preserved
    expect(merged['クイタンあり']).toBe(true)
  })

  it('computes xiangting (-1 for a complete hand)', () => {
    const shoupai = Shoupai.fromString('z33m123p456s789m234')
    expect(Util.xiangting(shoupai)).toBe(-1)
  })
})

import { fromMajiang, toMajiang, buildBingpai } from './majiang-adapter'
import type { TileCode } from './types'

describe('tile mapping', () => {
  const all: TileCode[] = [
    '1m','2m','3m','4m','5m','6m','7m','8m','9m','0m',
    '1p','2p','3p','4p','5p','6p','7p','8p','9p','0p',
    '1s','2s','3s','4s','5s','6s','7s','8s','9s','0s',
    '1z','2z','3z','4z','5z','6z','7z',
  ]

  it('round-trips every tile', () => {
    for (const tile of all) {
      expect(fromMajiang(toMajiang(tile)), tile).toBe(tile)
    }
  })

  it('maps red fives to 0 and honors honor numbering', () => {
    expect(toMajiang('0m')).toBe('m0')
    expect(toMajiang('5p')).toBe('p5')
    expect(toMajiang('1z')).toBe('z1')
    expect(toMajiang('7z')).toBe('z7')
  })

  it('builds a grouped bingpai string sorted by suit', () => {
    expect(buildBingpai(['3m', '1m', '2p', '1z', '2m'])).toBe('m123p2z1')
  })
})

import { scoreHand } from './majiang-adapter'
import type { ScoreInput } from './types'

describe('scoreHand (menzen)', () => {
  it('scores a dealer pinfu tsumo as 20fu / 3han', () => {
    const input: ScoreInput = {
      hand: ['2m','3m','4m','3p','4p','5p','4s','5s','6s','7p','8p','2z','2z'],
      winningTile: '9p',
      melds: [],
      context: {
        seatWind: '東', roundWind: '東', dealer: true, method: 'tsumo',
        conditions: ['門前','ツモ和了'], doraIndicators: ['3p'], ruleNotes: [],
      },
    }
    const r = scoreHand(input)
    expect(r.valid).toBe(true)
    expect(r.fu).toBe(20)
    expect(r.han).toBe(3) // 門前ツモ + 平和 + ドラ1
    expect(r.isLimit).toBe(false)
    expect(r.yaku.filter((y) => !y.isDora).map((y) => y.name)).toEqual(
      expect.arrayContaining(['門前清自摸和', '平和']),
    )
  })
})
