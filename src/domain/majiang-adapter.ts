import Majiang from '@kobalab/majiang-core'
import type {
  BreakdownItem, Meld, ScoreInput, ScoreResult, ScoreYaku, TileCode, Wind,
} from './types'
import { tileLabel } from './tiles'

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

// majiang の面子文字列（例: 'z444+!', 'm99_!'）の構成牌の牌名を返す。
function mianziTileLabel(m: string): string {
  const suit = m[0]
  const num = m[1] === '0' ? '5' : m[1]
  return tileLabel(`${num}${suit}` as TileCode)
}

// @kobalab/majiang-core lib/hule.js の get_hudi（符計算）を忠実に移植し、符の内訳
// ラベルを生成する。合計は呼び出し側で必ずエンジンの r.fu と突き合わせて採用する
// （不一致なら破棄）ので、表示が公式の点数とズレることはない。
function fuDetailForMianzi(
  mianzi: string[],
  zhuangfeng: number,
  menfeng: number,
  ruleObj: Record<string, unknown>,
): { fu: number; rows: BreakdownItem[] } | null {
  if (mianzi.length === 7) {
    return { fu: 25, rows: [{ label: '七対子（固定）', value: '25符' }] }
  }
  if (mianzi.length !== 5) return null // 国士・九蓮など（満貫以上で符は不要）

  const zhuangfengpai = new RegExp(`^z${zhuangfeng + 1}.*$`)
  const menfengpai = new RegExp(`^z${menfeng + 1}.*$`)
  const sanyuanpai = /^z[567].*$/
  const yaojiu = /^.*[z19].*$/
  const kezi = /^[mpsz](\d)\1\1.*$/
  const ankezi = /^[mpsz](\d)\1\1(?:\1|_!)?$/
  const gangzi = /^[mpsz](\d)\1\1.*\1.*$/
  const danqiRe = /^[mpsz](\d)\1[+=_-]!$/
  const kanzhang = /^[mps]\d\d[+=_-]!\d$/
  const bianzhang = /^[mps](123[+=_-]!|7[+=_-]!89)$/

  let menqian = true
  let zimo = true
  let danqi = false
  for (const m of mianzi) {
    if (/[+=-](?!!)/.test(m)) menqian = false
    if (/[+=-]!/.test(m)) zimo = false
    if (danqiRe.test(m)) danqi = true
  }

  let fu = 20
  const rows: BreakdownItem[] = [{ label: '副底', value: '20符' }]

  for (const m of mianzi) {
    if (m === mianzi[0]) {
      let f = 0
      if (zhuangfengpai.test(m)) f += 2
      if (menfengpai.test(m)) f += 2
      if (sanyuanpai.test(m)) f += 2
      f = ruleObj['連風牌は2符'] && f > 2 ? 2 : f
      if (f > 0) {
        fu += f
        rows.push({ label: `${mianziTileLabel(m)}の雀頭（役牌）`, value: `${f}符` })
      }
      if (danqi) {
        fu += 2
        rows.push({ label: '単騎待ち', value: '2符' })
      }
    } else if (kezi.test(m)) {
      let f = 2
      const isYao = yaojiu.test(m)
      const isAn = ankezi.test(m)
      const isGang = gangzi.test(m)
      if (isYao) f *= 2
      if (isAn) f *= 2
      if (isGang) f *= 4
      fu += f
      const kind = isGang ? (isAn ? '暗槓' : '明槓') : isAn ? '暗刻' : '明刻'
      rows.push({ label: `${mianziTileLabel(m)}の${kind}`, value: `${f}符` })
    } else {
      if (kanzhang.test(m)) {
        fu += 2
        rows.push({ label: '嵌張待ち', value: '2符' })
      }
      if (bianzhang.test(m)) {
        fu += 2
        rows.push({ label: '辺張待ち', value: '2符' })
      }
    }
  }

  const pinghu = menqian && fu === 20
  if (zimo) {
    if (!pinghu) {
      fu += 2
      rows.push({ label: 'ツモ', value: '2符' })
    }
  } else if (menqian) {
    fu += 10
    rows.push({ label: '門前ロン', value: '10符' })
  } else if (fu === 20) {
    fu = 30
    rows.push({ label: '喰い和了の最低符', value: '30符' })
  }

  const rounded = Math.ceil(fu / 10) * 10
  rows.push({ label: '合計', value: `${fu}符` })
  if (rounded !== fu) {
    rows.push({ label: '切り上げ', value: `${rounded}符` })
  }
  return { fu: rounded, rows }
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
    valid: false, yaku: [], han: 0, fu: null, fuDetail: null,
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

  // 満貫未満のときだけ符の内訳を出す。エンジンが選んだ面子分解を特定できないので、
  // 全分解を get_hudi 移植で計算し、合計が r.fu に一致するものを採用する。
  let fuDetail: BreakdownItem[] | null = null
  if (typeof r.fu === 'number' && !isLimit) {
    const decompositions = (
      Util as unknown as {
        hule_mianzi: (shoupai: unknown, rongpai: string | null) => string[][]
      }
    ).hule_mianzi(shoupai, rongpai)
    for (const mianzi of decompositions) {
      const detail = fuDetailForMianzi(
        mianzi,
        WIND_INDEX[context.roundWind],
        WIND_INDEX[context.seatWind],
        STANDARD_RULE,
      )
      if (detail && detail.fu === r.fu) {
        fuDetail = detail.rows
        break
      }
    }
  }

  return {
    valid: true, yaku, han, fu: r.fu ?? null, fuDetail,
    defen: r.defen, fenpei: r.fenpei ?? [], isLimit, dealer, method,
  }
}
