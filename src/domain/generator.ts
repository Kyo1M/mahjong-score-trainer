import type {
  Difficulty,
  DifficultyFilter,
  ScoreInput,
  ScoreResult,
  TileCode,
  Wind,
} from './types'
import { scoreHand } from './majiang-adapter'
import { classifyDifficulty } from './difficulty'
import { mapYakuName } from './yaku-map'
import type { Rng } from './rng'

const SUITS = ['m', 'p', 's'] as const
type NumSuit = (typeof SUITS)[number]

type Built = ScoreInput

// ---------------------------------------------------------------------------
// Context helper. Open archetypes MUST NOT set riichi / 一発 (enforced here:
// callers only pass those for menzen builds).
// ---------------------------------------------------------------------------
function ctx(
  rng: Rng,
  over: Partial<ScoreInput['context']> & { method: 'ron' | 'tsumo' },
): ScoreInput['context'] {
  const dealer = over.dealer ?? rng.bool(0.5)
  const roundWind = over.roundWind ?? '東'
  // Pick a non-round, non-yakuhai-collision seat wind for non-dealers so that
  // we never accidentally mint a 自風/場風 yaku from a wind pair/triplet.
  const seatWind =
    over.seatWind ?? (dealer ? '東' : rng.pick(['南', '西', '北'] as Wind[]))
  return {
    seatWind,
    roundWind,
    dealer,
    method: over.method,
    riichi: over.riichi,
    conditions: over.conditions ?? [],
    doraIndicators: over.doraIndicators ?? [],
    ruleNotes: ['Mリーグ準拠', '0本場・供託なし'],
  }
}

// A run of three consecutive number tiles: t, t+1, t+2.
function run(suit: NumSuit, t: number): TileCode[] {
  return [`${t}${suit}`, `${t + 1}${suit}`, `${t + 2}${suit}`] as TileCode[]
}
function trip(tile: TileCode): TileCode[] {
  return [tile, tile, tile]
}
function pair(tile: TileCode): TileCode[] {
  return [tile, tile]
}

// Pick a dora indicator that adds ZERO dora to the hand: the indicated tile
// (indicator+1, with honors/terminals wrapping) must not appear in the 14.
// We try honor indicators first (they almost never collide), then fall back to
// any number tile whose "next" tile is absent.
function safeDoraIndicator(rng: Rng, hand14: TileCode[]): TileCode {
  const counts = new Map<string, number>()
  const norm = (t: TileCode) => (t[0] === '0' ? `5${t[1]}` : t)
  for (const t of hand14) counts.set(norm(t), (counts.get(norm(t)) ?? 0) + 1)

  // The dora tile pointed to by an indicator.
  const doraOf = (ind: TileCode): string => {
    const n = Number(ind[0] === '0' ? 5 : ind[0])
    const suit = ind[1]
    if (suit === 'z') {
      // winds 1-4 cycle, dragons 5-7 cycle (白5→發6→中7→白5)
      if (n <= 4) return `${(n % 4) + 1}z`
      return `${n === 7 ? 5 : n + 1}z`
    }
    return `${n === 9 ? 1 : n + 1}${suit}`
  }

  const honors: TileCode[] = [
    '1z',
    '2z',
    '3z',
    '4z',
    '5z',
    '6z',
    '7z',
  ] as TileCode[]
  const numbers: TileCode[] = []
  for (const s of SUITS) for (let n = 1; n <= 9; n++) numbers.push(`${n}${s}` as TileCode)

  const candidates = [...honors, ...numbers]
  const safe = candidates.filter((ind) => {
    if ((counts.get(doraOf(ind)) ?? 0) !== 0) return false
    // Also keep the indicator itself out of the 14 (cosmetic / realism).
    return (counts.get(norm(ind)) ?? 0) < 4
  })
  return safe.length ? rng.pick(safe) : ('1z' as TileCode)
}

// Turn a complete 14-tile hand into a ScoreInput by removing one tile as the
// winning tile. `winIdx` selects which tile is claimed (must be a tile that
// keeps the remaining 13 a valid tenpai for that winning tile — callers pass a
// ryanmen edge so pinfu shapes survive).
function asInput(
  hand14: TileCode[],
  winTile: TileCode,
  base: Omit<Built, 'hand' | 'winningTile'>,
): Built {
  const idx = hand14.indexOf(winTile)
  const hand = [...hand14.slice(0, idx), ...hand14.slice(idx + 1)]
  return { ...base, hand, winningTile: winTile }
}

// ---------------------------------------------------------------------------
// Archetypes. Each returns a complete, valid ScoreInput.
// ---------------------------------------------------------------------------

type Archetype = { name: string; bias: Difficulty; build: (rng: Rng) => Built }

// --- starter: plain tanyao ron, no riichi, no dora. 1 han, 40fu. ---
function tanyaoRon(rng: Rng): Built {
  // Three suits of simple runs + a simple pair; win on a ryanmen edge.
  const head = `${rng.pick([2, 3, 4, 5, 6, 7, 8])}m` as TileCode
  const hand14: TileCode[] = [
    ...run('p', 2),
    ...run('p', 6),
    ...run('s', 3),
    ...run('s', 6),
    ...pair(head),
  ]
  // Claim 4p as a ryanmen edge (2-3p waiting 1/4); 4p is a simple so tanyao holds.
  return asInput(hand14, '4p', {
    melds: [],
    context: ctx(rng, {
      method: 'ron',
      conditions: ['門前', 'ロン和了'],
      doraIndicators: [safeDoraIndicator(rng, hand14)],
    }),
  })
}

// --- starter: plain pinfu ron, no riichi, no dora. 1 han, 30fu. ---
function pinfuRon(rng: Rng): Built {
  const head = `${rng.pick([2, 3, 4, 6, 7, 8])}s` as TileCode // non-yakuhai number head
  const hand14: TileCode[] = [
    ...run('m', 1),
    ...run('m', 5),
    ...run('p', 2),
    ...run('p', 6),
    ...pair(head),
  ]
  // Claim 7m from the 5-6-7m run (5-6 waiting 4/7 ryanmen) to keep pinfu.
  return asInput(hand14, '7m', {
    melds: [],
    context: ctx(rng, {
      method: 'ron',
      conditions: ['門前', 'ロン和了'],
      doraIndicators: [safeDoraIndicator(rng, hand14)],
    }),
  })
}

// --- standard: riichi + pinfu (+ maybe tsumo) menzen, no dora. ---
function riichiPinfu(rng: Rng): Built {
  const head = `${rng.pick([2, 3, 4, 6, 7, 8])}s` as TileCode
  const hand14: TileCode[] = [
    ...run('m', 1),
    ...run('m', 5),
    ...run('p', 2),
    ...run('p', 6),
    ...pair(head),
  ]
  const tsumo = rng.bool(0.5)
  const ippatsu = rng.bool(0.4)
  const riichi = '立直' as const
  return asInput(hand14, '7m', {
    melds: [],
    context: ctx(rng, {
      method: tsumo ? 'tsumo' : 'ron',
      riichi,
      conditions: [
        '門前',
        tsumo ? 'ツモ和了' : 'ロン和了',
        ...(ippatsu ? ['一発'] : []),
      ],
      doraIndicators: [safeDoraIndicator(rng, hand14)],
    }),
  })
}

// --- standard: chiitoitsu menzen (七対子 alone, 25fu, 2 han). ---
function chiitoitsu(rng: Rng): Built {
  const pairsTiles: TileCode[] = []
  const used = new Set<string>()
  while (pairsTiles.length < 14) {
    const suit = rng.pick([...SUITS, 'z'] as const)
    const max = suit === 'z' ? 7 : 9
    const n = 1 + rng.int(max)
    const key = `${n}${suit}`
    if (used.has(key)) continue
    used.add(key)
    pairsTiles.push(key as TileCode, key as TileCode)
  }
  // Claim one of a pair as the winning tile (tanki wait on that pair).
  const winTile = pairsTiles[0]
  return asInput(pairsTiles, winTile, {
    melds: [],
    context: ctx(rng, {
      method: rng.bool(0.5) ? 'tsumo' : 'ron',
      conditions: ['門前', 'ロン和了'],
      doraIndicators: [safeDoraIndicator(rng, pairsTiles)],
    }),
  })
}

// --- advanced: dragon yakuhai pon (open). ---
function yakuhaiPon(rng: Rng): Built {
  const dragon = rng.pick(['5z', '6z', '7z'] as TileCode[])
  // Open pon of dragon + 3 concealed runs + a simple pair.
  const head = `${rng.pick([2, 3, 4, 5, 6, 7, 8])}m` as TileCode
  const concealed14: TileCode[] = [
    ...run('p', 2),
    ...run('p', 6),
    ...run('s', 3),
    ...pair(head),
  ]
  // concealed14 here is 11 tiles (3+3+3+2). With the open pon (3) that's 14.
  // Win on a ryanmen: claim 4p (2-3 waiting 1/4).
  const winTile: TileCode = '4p'
  const idx = concealed14.indexOf(winTile)
  const hand = [...concealed14.slice(0, idx), ...concealed14.slice(idx + 1)]
  const all = [...concealed14, ...trip(dragon)]
  return {
    hand,
    winningTile: winTile,
    melds: [{ kind: 'pon', tiles: trip(dragon), open: true, label: `${dragon}ポン` }],
    context: ctx(rng, {
      method: 'ron',
      conditions: ['副露あり', 'ロン和了'],
      doraIndicators: [safeDoraIndicator(rng, all)],
    }),
  }
}

// --- advanced: honitsu (混一色) open. ---
function honitsuOpen(rng: Rng): Built {
  const s = rng.pick(SUITS)
  const dragon = rng.pick(['5z', '6z', '7z'] as TileCode[])
  // Open pon of dragon (kuisagari honitsu 2 han + yakuhai 1).
  // Concealed: 3 runs/triplets in one suit + a pair, all same suit + honors.
  const head = `${rng.pick([2, 5, 8])}${s}` as TileCode
  const concealed14: TileCode[] = [
    ...run(s, 1),
    ...run(s, 4),
    ...run(s, 7),
    ...pair(head),
  ]
  const winTile = `4${s}` as TileCode // ryanmen edge: 5-6 of the 4-5-6 run waits 4/7
  const idx = concealed14.indexOf(winTile)
  const hand = [...concealed14.slice(0, idx), ...concealed14.slice(idx + 1)]
  const all = [...concealed14, ...trip(dragon)]
  return {
    hand,
    winningTile: winTile,
    melds: [{ kind: 'pon', tiles: trip(dragon), open: true, label: `${dragon}ポン` }],
    context: ctx(rng, {
      method: 'ron',
      conditions: ['副露あり', 'ロン和了'],
      doraIndicators: [safeDoraIndicator(rng, all)],
    }),
  }
}

// --- advanced: toitoi (対々和) open pon. ---
function toitoiPon(rng: Rng): Built {
  // Four triplets + a pair. One triplet ponned (open). Win by ron on the pair
  // (shanpon) is messy; instead win on completing a concealed triplet (ron makes
  // it a "minko" via ron — still toitoi). Use simple/terminal triplets to avoid
  // accidental yakuhai winds.
  const t1 = `2${SUITS[0]}` as TileCode
  const t2 = `5${SUITS[1]}` as TileCode
  const t3 = `8${SUITS[2]}` as TileCode
  const t4 = `3${SUITS[1]}` as TileCode
  const head = `7${SUITS[0]}` as TileCode
  // Open pon: t1. Concealed: t2,t3,t4 triplets + head pair (3+3+3+2 = 11). Win on
  // shanpon completing t4 (claim one t4).
  const concealed: TileCode[] = [...trip(t2), ...trip(t3), ...trip(t4), ...pair(head)]
  const winTile = t4
  const idx = concealed.indexOf(winTile)
  const hand = [...concealed.slice(0, idx), ...concealed.slice(idx + 1)]
  const all = [...concealed, ...trip(t1)]
  return {
    hand,
    winningTile: winTile,
    melds: [{ kind: 'pon', tiles: trip(t1), open: true, label: `${t1}ポン` }],
    context: ctx(rng, {
      method: 'ron',
      conditions: ['副露あり', 'ロン和了'],
      doraIndicators: [safeDoraIndicator(rng, all)],
    }),
  }
}

// --- advanced: ittsu (一気通貫) menzen. ---
function ittsuMenzen(rng: Rng): Built {
  const s = rng.pick(SUITS)
  const other = rng.pick(SUITS.filter((x) => x !== s) as NumSuit[])
  const head = `${rng.pick([2, 3, 4, 6, 7, 8])}${other}` as TileCode
  const hand14: TileCode[] = [
    ...run(s, 1),
    ...run(s, 4),
    ...run(s, 7),
    ...run(other, 2),
    ...pair(head),
  ]
  // Win on the 7-8-9 run edge — claim 7 (8-9 wait 7) is penchan; use the 2-3-4
  // run of `other` for a ryanmen edge: claim 4 (2-3 waiting 1/4).
  return asInput(hand14, `4${other}` as TileCode, {
    melds: [],
    context: ctx(rng, {
      method: rng.bool(0.5) ? 'tsumo' : 'ron',
      conditions: ['門前', 'ロン和了'],
      doraIndicators: [safeDoraIndicator(rng, hand14)],
    }),
  })
}

// --- limit: chinitsu (清一色) menzen — 6 han, mangan+. ---
function chinitsuMenzen(rng: Rng): Built {
  const s = rng.pick(SUITS)
  const head = `${rng.pick([2, 5, 8])}${s}` as TileCode
  const hand14: TileCode[] = [
    ...run(s, 1),
    ...run(s, 4),
    ...run(s, 7),
    ...run(s, 2),
    ...pair(head),
  ]
  // Win on a ryanmen edge of the 4-5-6 run: claim 6 (4-5 waiting 3/6).
  const win = `6${s}` as TileCode
  // ensure that tile actually exists in the array (it does: run(s,4) gives 4,5,6)
  return asInput(hand14, win, {
    melds: [],
    context: ctx(rng, {
      method: rng.bool(0.5) ? 'tsumo' : 'ron',
      conditions: ['門前', 'ロン和了'],
      doraIndicators: [safeDoraIndicator(rng, hand14)],
    }),
  })
}

// --- limit: honitsu + riichi menzen — pushes to mangan-class with extras. ---
function honitsuRiichi(rng: Rng): Built {
  const s = rng.pick(SUITS)
  const dragon = rng.pick(['5z', '6z', '7z'] as TileCode[])
  const head = `${rng.pick([2, 5, 8])}${s}` as TileCode
  // Menzen honitsu (3 han) + dragon triplet (1) + riichi (1) + maybe tsumo (1).
  const hand14: TileCode[] = [
    ...run(s, 1),
    ...run(s, 4),
    ...trip(dragon),
    ...pair(head),
  ]
  // That's 3+3+3+2 = 11; add one more run to reach 14.
  const hand14b: TileCode[] = [...hand14.slice(0, 6), ...run(s, 7), ...hand14.slice(6)]
  const tsumo = rng.bool(0.5)
  return asInput(hand14b, `4${s}` as TileCode, {
    melds: [],
    context: ctx(rng, {
      method: tsumo ? 'tsumo' : 'ron',
      riichi: '立直',
      conditions: ['門前', tsumo ? 'ツモ和了' : 'ロン和了'],
      doraIndicators: [safeDoraIndicator(rng, hand14b)],
    }),
  })
}

const ARCHETYPES: Archetype[] = [
  { name: 'tanyao-ron', bias: 'starter', build: tanyaoRon },
  { name: 'pinfu-ron', bias: 'starter', build: pinfuRon },
  { name: 'riichi-pinfu', bias: 'standard', build: riichiPinfu },
  { name: 'chiitoitsu', bias: 'standard', build: chiitoitsu },
  { name: 'yakuhai-pon', bias: 'advanced', build: yakuhaiPon },
  { name: 'honitsu-open', bias: 'advanced', build: honitsuOpen },
  { name: 'toitoi-pon', bias: 'advanced', build: toitoiPon },
  { name: 'ittsu-menzen', bias: 'advanced', build: ittsuMenzen },
  { name: 'chinitsu-menzen', bias: 'limit', build: chinitsuMenzen },
  { name: 'honitsu-riichi', bias: 'limit', build: honitsuRiichi },
]

function archetypesFor(filter: DifficultyFilter): Archetype[] {
  if (filter === 'mix') return ARCHETYPES
  const biased = ARCHETYPES.filter((a) => a.bias === filter)
  return biased.length ? biased : ARCHETYPES
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

function countsOk(tiles: TileCode[]): boolean {
  if (tiles.length !== 14) return false
  const norm = (t: TileCode) => (t[0] === '0' ? `5${t[1]}` : t)
  const counts = new Map<string, number>()
  for (const t of tiles) {
    const k = norm(t)
    const c = (counts.get(k) ?? 0) + 1
    if (c > 4) return false
    counts.set(k, c)
  }
  return true
}

function accept(
  input: ScoreInput,
  result: ScoreResult,
  filter: DifficultyFilter,
): boolean {
  if (!result.valid) return false
  if (!countsOk(totalTiles(input))) return false
  // Every non-dora yaku must map to the catalog.
  for (const y of result.yaku) {
    if (y.isDora) continue
    if (mapYakuName(y.name) === null) return false
  }
  // Consistency: open hands carry no riichi/ippatsu (enforced by construction,
  // double-checked here).
  const open = input.melds.some((m) => m.open)
  if (open) {
    if (input.context.riichi) return false
    if (input.context.conditions.includes('一発')) return false
  }
  if (!realistic(result, filter)) return false
  if (filter !== 'mix' && classifyDifficulty(result, input) !== filter) return false
  return true
}

export function generate(
  filter: DifficultyFilter,
  rng: Rng,
): { input: ScoreInput; result: ScoreResult } {
  const pool = archetypesFor(filter)
  for (let attempt = 0; attempt < 400; attempt++) {
    const arch = rng.pick(pool)
    let input: ScoreInput
    try {
      input = arch.build(rng)
    } catch {
      continue
    }
    const result = scoreHand(input)
    if (accept(input, result, filter)) return { input, result }
  }
  // Fallback: relax difficulty/realism, return any valid mappable hand from the
  // biased pool (still satisfies the 14-tile / valid invariants).
  for (let attempt = 0; attempt < 400; attempt++) {
    const arch = rng.pick(pool)
    let input: ScoreInput
    try {
      input = arch.build(rng)
    } catch {
      continue
    }
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
