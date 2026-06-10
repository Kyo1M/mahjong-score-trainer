import type {
  DifficultyFilter,
  ScoreInput,
  ScoreResult,
  TileCode,
} from './types'
import { scoreHand } from './majiang-adapter'
import { classifyDifficulty } from './difficulty'
import { mapYakuName } from './yaku-map'
import type { Rng } from './rng'
import {
  NUM_SUITS,
  buildRandomHand,
  countsOk,
  ctx,
  doraIndicatorFor,
} from './hand-builder'
import type { Block } from './hand-builder'

// ---------------------------------------------------------------------------
// テーマ: 出題の「狙い」。build が ScoreInput | null を返し、エンジン採点後に
// accept()（+ acceptExtra）で選別する。
// ---------------------------------------------------------------------------
type Theme = {
  name: string
  build: (rng: Rng) => ScoreInput | null
  acceptExtra?: (result: ScoreResult) => boolean
}

const free: Theme = { name: 'free', build: (rng) => buildRandomHand(rng) }

// 入門寄り: 数牌の順子中心・門前・ドラ少なめ（平和・断幺九・立直系が出やすい）
const simple: Theme = {
  name: 'simple',
  build: (rng) =>
    buildRandomHand(rng, {
      tripletWeight: 0.12,
      allowHonors: false,
      openMax: 0,
      doraMax: 1,
    }),
}

const ittsu: Theme = {
  name: 'ittsu',
  build: (rng) => {
    const suit = rng.pick(NUM_SUITS)
    const forcedBlocks: Block[] = [
      { kind: 'run', suit, start: 1 },
      { kind: 'run', suit, start: 4 },
      { kind: 'run', suit, start: 7 },
    ]
    return buildRandomHand(rng, { forcedBlocks, tripletWeight: 0.2 })
  },
}

const sanshoku: Theme = {
  name: 'sanshoku',
  build: (rng) => {
    const start = 1 + rng.int(7)
    const forcedBlocks: Block[] = NUM_SUITS.map((suit) => ({
      kind: 'run' as const,
      suit,
      start,
    }))
    return buildRandomHand(rng, { forcedBlocks, tripletWeight: 0.2 })
  },
}

const honitsu: Theme = {
  name: 'honitsu',
  build: (rng) =>
    buildRandomHand(rng, {
      suitPool: [rng.pick(NUM_SUITS)],
      honorWeight: 0.7,
      tripletWeight: 0.4,
    }),
}

const chinitsu: Theme = {
  name: 'chinitsu',
  build: (rng) =>
    buildRandomHand(rng, {
      suitPool: [rng.pick(NUM_SUITS)],
      allowHonors: false,
    }),
}

const yakuhai: Theme = {
  name: 'yakuhai',
  build: (rng) => {
    const dragon = rng.pick(['5z', '6z', '7z'] as TileCode[])
    return buildRandomHand(rng, {
      forcedBlocks: [{ kind: 'triplet', tile: dragon }],
    })
  },
}

// チャンタ・純チャン・混老頭が出やすい幺九寄せ
const terminal: Theme = {
  name: 'terminal',
  build: (rng) => buildRandomHand(rng, { terminalBias: true, tripletWeight: 0.45 }),
}

const chiitoitsu: Theme = {
  name: 'chiitoitsu',
  build: (rng) => {
    const pairsTiles: TileCode[] = []
    const used = new Set<string>()
    while (pairsTiles.length < 14) {
      const suit = rng.pick([...NUM_SUITS, 'z'] as const)
      const max = suit === 'z' ? 7 : 9
      const n = 1 + rng.int(max)
      const key = `${n}${suit}`
      if (used.has(key)) continue
      used.add(key)
      pairsTiles.push(key as TileCode, key as TileCode)
    }
    const winTile = pairsTiles[0]
    const idx = pairsTiles.indexOf(winTile)
    const hand = [...pairsTiles.slice(0, idx), ...pairsTiles.slice(idx + 1)]
    const tsumo = rng.bool(0.5)
    return {
      hand,
      winningTile: winTile,
      melds: [],
      context: ctx(rng, {
        method: tsumo ? 'tsumo' : 'ron',
        riichi: rng.bool(0.5) ? '立直' : undefined,
        conditions: ['門前', tsumo ? 'ツモ和了' : 'ロン和了'],
        doraIndicators: [doraIndicatorFor(rng, pairsTiles, 0) ?? ('1z' as TileCode)],
      }),
    }
  },
}

// 符ドリル: 幺九牌・字牌の暗刻 2〜3 個 + 悪い待ち + 門前ロンで 50〜70 符を狙う
const fuDrill: Theme = {
  name: 'fu-drill',
  build: (rng) => {
    const yaojiu: TileCode[] = [
      '1m', '9m', '1p', '9p', '1s', '9s',
      '1z', '2z', '3z', '4z', '5z', '6z', '7z',
    ]
    const count = rng.bool(0.5) ? 2 : 3
    const picked = new Set<TileCode>()
    while (picked.size < count) picked.add(rng.pick(yaojiu))
    const forcedBlocks: Block[] = [...picked].map((tile) => ({
      kind: 'triplet' as const,
      tile,
    }))
    return buildRandomHand(rng, {
      forcedBlocks,
      tripletWeight: 0,
      openMax: 0,
      riichiWeight: 1,
      doraMax: 0,
      waitBias: 'bad',
      methodBias: 'ron',
    })
  },
  acceptExtra: (result) =>
    !result.isLimit && (result.fu ?? 0) >= 50 && (result.fu ?? 0) <= 70,
}

// テスト専用: テーマを直接叩いて符ドリルの分布などを検証する。
export const __themesForTest = { fuDrill }

type Weighted = { theme: Theme; weight: number }

const POOLS: Record<DifficultyFilter, Weighted[]> = {
  mix: [
    { theme: free, weight: 50 },
    { theme: simple, weight: 8 },
    { theme: ittsu, weight: 4 },
    { theme: sanshoku, weight: 5 },
    { theme: honitsu, weight: 5 },
    { theme: chinitsu, weight: 4 },
    { theme: yakuhai, weight: 6 },
    { theme: terminal, weight: 5 },
    { theme: chiitoitsu, weight: 6 },
    { theme: fuDrill, weight: 7 },
  ],
  starter: [
    { theme: simple, weight: 70 },
    { theme: free, weight: 30 },
  ],
  standard: [
    { theme: free, weight: 45 },
    { theme: simple, weight: 10 },
    { theme: chiitoitsu, weight: 15 },
    { theme: yakuhai, weight: 15 },
    { theme: sanshoku, weight: 8 },
    { theme: ittsu, weight: 7 },
  ],
  advanced: [
    { theme: free, weight: 25 },
    { theme: fuDrill, weight: 20 },
    { theme: terminal, weight: 12 },
    { theme: honitsu, weight: 12 },
    { theme: yakuhai, weight: 11 },
    { theme: ittsu, weight: 10 },
    { theme: sanshoku, weight: 10 },
  ],
  limit: [
    { theme: chinitsu, weight: 40 },
    { theme: honitsu, weight: 40 },
    { theme: free, weight: 20 },
  ],
}

function pickTheme(rng: Rng, pool: Weighted[]): Theme {
  const total = pool.reduce((s, w) => s + w.weight, 0)
  let r = rng.next() * total
  for (const w of pool) {
    r -= w.weight
    if (r < 0) return w.theme
  }
  return pool[pool.length - 1].theme
}

// 非ドラ役のキーを正規化した「役構成シグネチャ」。バラエティガードに使う。
export function yakuSignature(result: ScoreResult): string {
  return result.yaku
    .filter((y) => !y.isDora)
    .map((y) => mapYakuName(y.name)?.key ?? y.name)
    .sort()
    .join('+')
}

function realistic(result: ScoreResult, filter: DifficultyFilter): boolean {
  const doraHan = result.yaku.filter((y) => y.isDora).reduce((s, y) => s + y.han, 0)
  if (doraHan > 3) return false
  if (filter === 'starter' && result.han > 3) return false
  return true
}

function totalTiles(input: ScoreInput): TileCode[] {
  return [...input.hand, input.winningTile, ...input.melds.flatMap((m) => m.tiles)]
}

function accept(
  input: ScoreInput,
  result: ScoreResult,
  filter: DifficultyFilter,
): boolean {
  if (!result.valid) return false
  if (!countsOk(totalTiles(input))) return false
  for (const y of result.yaku) {
    if (y.isDora) continue
    if (mapYakuName(y.name) === null) return false
  }
  const open = input.melds.some((m) => m.open)
  if (open) {
    if (input.context.riichi) return false
    if (input.context.conditions.includes('一発')) return false
  }
  if (!realistic(result, filter)) return false
  if (filter !== 'mix' && classifyDifficulty(result, input) !== filter) return false
  return true
}

export type GenerateOptions = {
  avoid?: string[] // 直近の役構成シグネチャ（連続出題の抑止。ベストエフォート）
}

export function generate(
  filter: DifficultyFilter,
  rng: Rng,
  options: GenerateOptions = {},
): { input: ScoreInput; result: ScoreResult } {
  const pool = POOLS[filter]
  const avoid = options.avoid ?? []

  for (let attempt = 0; attempt < 400; attempt++) {
    const theme = pickTheme(rng, pool)
    let input: ScoreInput | null
    try {
      input = theme.build(rng)
    } catch {
      continue
    }
    if (!input) continue
    const result = scoreHand(input)
    if (!accept(input, result, filter)) continue
    if (theme.acceptExtra && !theme.acceptExtra(result)) continue
    if (avoid.includes(yakuSignature(result))) continue
    return { input, result }
  }

  // フォールバック: 現実性・バラエティガード・テーマ追加条件を緩めて、妥当な手を返す。
  for (let attempt = 0; attempt < 400; attempt++) {
    const theme = pickTheme(rng, pool)
    let input: ScoreInput | null
    try {
      input = theme.build(rng)
    } catch {
      continue
    }
    if (!input) continue
    const result = scoreHand(input)
    if (!result.valid) continue
    if (!countsOk(totalTiles(input))) continue
    let mappable = true
    for (const y of result.yaku) {
      if (y.isDora) continue
      if (mapYakuName(y.name) === null) mappable = false
    }
    if (!mappable) continue
    if (filter === 'mix' || classifyDifficulty(result, input) === filter) {
      return { input, result }
    }
  }
  throw new Error('generator: failed to produce a valid hand')
}
