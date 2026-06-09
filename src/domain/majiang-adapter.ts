import Majiang from '@kobalab/majiang-core'
import type { Meld, ScoreInput, ScoreResult, ScoreYaku, TileCode, Wind } from './types'

const { Shoupai, Util, rule } = Majiang

// 標準ルール: 切り上げ満貫なし（30符4翻・60符3翻は満貫未満の 7700/11600 点）。
// 13 翻以上は数え役満、連風牌の雀頭は 2 符。
const STANDARD_RULE = rule({
  切り上げ満貫あり: false,
  数え役満あり: true,
  連風牌は2符: true,
})

const WIND_INDEX: Record<Wind, number> = { 東: 0, 南: 1, 西: 2, 北: 3 }

const DORA_NAMES = new Set(['ドラ', '赤ドラ', '裏ドラ'])

const SUIT_ORDER = ['m', 'p', 's', 'z'] as const

export function toMajiang(tile: TileCode): string {
  // TileCode は `${number}${suit}`（赤は 0）、z は 1..7。majiang は `${suit}${number}`。
  const num = tile[0]
  const suit = tile[1]
  return `${suit}${num}`
}

export function fromMajiang(pai: string): TileCode {
  const suit = pai[0]
  const num = pai[1]
  return `${num}${suit}` as TileCode
}

export function buildBingpai(tiles: TileCode[]): string {
  const bySuit: Record<string, number[]> = { m: [], p: [], s: [], z: [] }
  for (const tile of tiles) {
    const suit = tile[1]
    bySuit[suit].push(Number(tile[0]))
  }
  let out = ''
  for (const suit of SUIT_ORDER) {
    const nums = bySuit[suit]
    if (nums.length === 0) continue
    nums.sort((a, b) => a - b)
    out += suit + nums.join('')
  }
  return out
}

function meldToMajiang(meld: Meld): string {
  const nums = meld.tiles.map((t) => Number(t[0]))
  const suit = meld.tiles[0][1]
  if (!meld.open) {
    return suit + nums.join('') // 暗槓（v1 では稀）
  }
  if (meld.kind === 'chi') {
    const sorted = [...nums].sort((a, b) => a - b)
    return `${suit}${sorted[0]}-${sorted[1]}${sorted[2]}` // チーは上家(-)
  }
  return `${suit}${nums.join('')}+` // ポン/明槓は下家(+)
}

export function scoreHand(input: ScoreInput): ScoreResult {
  const { hand, winningTile, melds, context } = input
  const dealer = context.dealer
  const method = context.method

  const bingpai = buildBingpai(hand)
  const meldStrs = melds.map(meldToMajiang)
  const paistr = [bingpai, ...meldStrs].join(',')
  const shoupai = Shoupai.fromString(paistr)

  let rongpai: string | null = null
  if (method === 'tsumo') {
    shoupai.zimo(toMajiang(winningTile))
  } else {
    rongpai = `${toMajiang(winningTile)}+`
  }

  // 重要: flat な param を直接 Util.hule に渡すと throw する。必ず hule_param で正規化する。
  const param = Util.hule_param({
    rule: STANDARD_RULE,
    zhuangfeng: WIND_INDEX[context.roundWind],
    menfeng: WIND_INDEX[context.seatWind],
    lizhi: context.riichi === 'ダブル立直' ? 2 : context.riichi ? 1 : 0,
    yifa: context.conditions.includes('一発'),
    baopai: context.doraIndicators.map(toMajiang),
  })
  const r = Util.hule(shoupai, rongpai, param)

  const invalid: ScoreResult = {
    valid: false, yaku: [], han: 0, fu: null,
    defen: 0, fenpei: [], isLimit: false, dealer, method,
  }

  if (!r || !r.hupai || r.hupai.length === 0) return invalid
  if (r.damanguan != null) return invalid // 役満は出題しない
  if (r.hupai.some((y) => y.fanshu === '*' || y.fanshu === '**')) return invalid

  const yaku: ScoreYaku[] = r.hupai.map((y) => ({
    name: y.name,
    han: Number(y.fanshu),
    isDora: DORA_NAMES.has(y.name),
  }))
  const han = r.fanshu ?? yaku.reduce((sum, y) => sum + y.han, 0)
  const manganDefen = dealer ? 12000 : 8000
  const isLimit = han >= 5 || r.defen >= manganDefen

  return {
    valid: true, yaku, han, fu: r.fu ?? null,
    defen: r.defen, fenpei: r.fenpei ?? [], isLimit, dealer, method,
  }
}
