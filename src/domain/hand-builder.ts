import type { Meld, ScoreInput, TileCode, Wind } from './types'
import type { Rng } from './rng'

export const NUM_SUITS = ['m', 'p', 's'] as const
export type NumSuit = (typeof NUM_SUITS)[number]

export type Block =
  | { kind: 'run'; suit: NumSuit; start: number } // start は 1..7
  | { kind: 'triplet'; tile: TileCode }

export type BuilderOptions = {
  forcedBlocks?: Block[]   // 必ず含めるブロック（一通・三色・役牌などの制約注入）
  tripletWeight?: number   // 自由ブロックが刻子になる確率（既定 0.3）
  honorWeight?: number     // 刻子が字牌になる確率（既定 0.25）
  suitPool?: NumSuit[]     // 数牌ブロックのスート制限（混一色・清一色用）
  allowHonors?: boolean    // 字牌（刻子・雀頭）を許可（既定 true）
  terminalBias?: boolean   // 幺九絡みブロックに限定（チャンタ系）
  openMax?: number         // 副露の最大数 0..2（既定 2）
  riichiWeight?: number    // 門前時に立直する確率（既定 0.55）
  doraMax?: number         // ドラの最大枚数 0..2（既定 2）
  waitBias?: 'bad'         // 嵌張・辺張・単騎・シャンポンに寄せる（符ドリル用）
  methodBias?: 'ron'       // ロン固定。門前ロンの10符を狙う符ドリルでは openMax:0 と併用すること
}

const HONORS: TileCode[] = ['1z', '2z', '3z', '4z', '5z', '6z', '7z']

function blockTiles(block: Block): TileCode[] {
  if (block.kind === 'run') {
    const { suit, start } = block
    return [`${start}${suit}`, `${start + 1}${suit}`, `${start + 2}${suit}`] as TileCode[]
  }
  return [block.tile, block.tile, block.tile]
}

export function countsOk(tiles: TileCode[]): boolean {
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

// 状況の抽選。副露ありの手では riichi / 一発を渡さないこと（呼び出し側の責務）。
export function ctx(
  rng: Rng,
  over: Partial<ScoreInput['context']> & { method: 'ron' | 'tsumo' },
): ScoreInput['context'] {
  const dealer = over.dealer ?? rng.bool(0.5)
  const roundWind = over.roundWind ?? '東'
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
    ruleNotes: ['切り上げ満貫なし', '0本場・供託なし'],
  }
}

// 表示牌が指す牌（数牌は+1巡回、風牌1-4巡回、三元牌5-7巡回）
function doraOf(ind: TileCode): string {
  const n = Number(ind[0] === '0' ? 5 : ind[0])
  const suit = ind[1]
  if (suit === 'z') {
    if (n <= 4) return `${(n % 4) + 1}z`
    return `${n === 7 ? 5 : n + 1}z`
  }
  return `${n === 9 ? 1 : n + 1}${suit}`
}

// 手牌14枚に「ちょうど want 枚」ドラが乗る表示牌を選ぶ。該当なしなら null。
export function doraIndicatorFor(
  rng: Rng,
  hand14: TileCode[],
  want: number,
): TileCode | null {
  const norm = (t: TileCode) => (t[0] === '0' ? `5${t[1]}` : t)
  const counts = new Map<string, number>()
  for (const t of hand14) counts.set(norm(t), (counts.get(norm(t)) ?? 0) + 1)

  const candidates: TileCode[] = [...HONORS]
  for (const s of NUM_SUITS) {
    for (let n = 1; n <= 9; n++) candidates.push(`${n}${s}` as TileCode)
  }
  const matching = candidates.filter((ind) => {
    if ((counts.get(doraOf(ind)) ?? 0) !== want) return false
    return (counts.get(norm(ind)) ?? 0) < 4 // 表示牌自体が4枚使われていない（見た目の現実性）
  })
  return matching.length ? rng.pick(matching) : null
}

function randomBlock(rng: Rng, opts: Required<Pick<BuilderOptions,
  'tripletWeight' | 'honorWeight' | 'allowHonors'>> & Pick<BuilderOptions, 'suitPool' | 'terminalBias'>,
): Block {
  const suits = opts.suitPool ?? [...NUM_SUITS]
  if (rng.bool(opts.tripletWeight)) {
    if (opts.allowHonors && rng.bool(opts.honorWeight)) {
      return { kind: 'triplet', tile: rng.pick(HONORS) }
    }
    const suit = rng.pick(suits)
    const n = opts.terminalBias ? rng.pick([1, 9]) : 1 + rng.int(9)
    return { kind: 'triplet', tile: `${n}${suit}` as TileCode }
  }
  const suit = rng.pick(suits)
  const start = opts.terminalBias ? rng.pick([1, 7]) : 1 + rng.int(7)
  return { kind: 'run', suit, start }
}

function randomPair(rng: Rng, opts: Pick<BuilderOptions, 'suitPool' | 'allowHonors' | 'terminalBias'>): TileCode {
  const suits = opts.suitPool ?? [...NUM_SUITS]
  if ((opts.allowHonors ?? true) && rng.bool(0.25)) return rng.pick(HONORS)
  const suit = rng.pick(suits)
  const n = opts.terminalBias ? rng.pick([1, 9]) : 1 + rng.int(9)
  return `${n}${suit}` as TileCode
}

function meldLabel(block: Block): string {
  if (block.kind === 'run') return `${block.start}${block.suit}チー`
  return `${block.tile}ポン`
}

// 完成形を組み立てて ScoreInput を返す。矛盾形（同一牌5枚以上など）は null。
export function buildRandomHand(rng: Rng, options: BuilderOptions = {}): ScoreInput | null {
  const opts = {
    tripletWeight: options.tripletWeight ?? 0.3,
    honorWeight: options.honorWeight ?? 0.25,
    allowHonors: options.allowHonors ?? true,
    suitPool: options.suitPool,
    terminalBias: options.terminalBias,
  }
  const openMax = options.openMax ?? 2
  const riichiWeight = options.riichiWeight ?? 0.55
  const doraMax = options.doraMax ?? 2

  // 1) ブロック（雀頭1 + 面子4）
  const blocks: Block[] = [...(options.forcedBlocks ?? [])]
  while (blocks.length < 4) blocks.push(randomBlock(rng, opts))
  const pairTile = randomPair(rng, options)

  const tiles14: TileCode[] = [pairTile, pairTile, ...blocks.flatMap(blockTiles)]
  if (!countsOk(tiles14)) return null

  // 2) 待ちの選択: ブロックか雀頭から和了牌を選ぶ
  type Wait = { winTile: TileCode; fromBlock: number | 'pair' }
  const waits: Wait[] = []
  blocks.forEach((b, i) => {
    const t = blockTiles(b)
    if (b.kind === 'run') {
      waits.push({ winTile: t[0], fromBlock: i }) // 端: 両面/辺張
      waits.push({ winTile: t[2], fromBlock: i }) // 端: 両面/辺張
      waits.push({ winTile: t[1], fromBlock: i }) // 中央: 嵌張
    } else {
      waits.push({ winTile: t[0], fromBlock: i }) // シャンポン
    }
  })
  waits.push({ winTile: pairTile, fromBlock: 'pair' }) // 単騎

  const badWaits = waits.filter((w) => {
    if (w.fromBlock === 'pair') return true // 単騎
    const b = blocks[w.fromBlock]
    if (b.kind === 'triplet') return true // シャンポン
    const t = blockTiles(b)
    if (w.winTile === t[1]) return true // 嵌張
    // 辺張: 123 の 3 / 789 の 7
    return (b.start === 1 && w.winTile === t[2]) || (b.start === 7 && w.winTile === t[0])
  })
  const pool = options.waitBias === 'bad' && badWaits.length ? badWaits : waits
  const wait = rng.pick(pool)

  // 3) 副露: 和了牌を含まないブロックから 0..openMax 個を開く
  const openCount = rng.int(openMax + 1)
  const openable = blocks
    .map((_, i) => i)
    .filter((i) => i !== wait.fromBlock)
  const openIdx = new Set<number>()
  while (openIdx.size < openCount && openIdx.size < openable.length) {
    openIdx.add(rng.pick(openable))
  }

  const melds: Meld[] = [...openIdx].map((i) => {
    const b = blocks[i]
    return {
      kind: b.kind === 'run' ? 'chi' : 'pon',
      tiles: blockTiles(b),
      open: true,
      label: meldLabel(b),
    }
  })

  // 4) 門前部分の13枚（完成形から副露牌と和了牌1枚を除く）
  const concealed: TileCode[] = [pairTile, pairTile]
  blocks.forEach((b, i) => {
    if (!openIdx.has(i)) concealed.push(...blockTiles(b))
  })
  const winPos = concealed.indexOf(wait.winTile)
  // 純粋に防御的（通常到達しない）: 待ちブロックは openable から除外されるため
  // 和了牌は必ず concealed に残る。形の都合で取り出せない場合のみ null。
  if (winPos < 0) return null
  const hand = [...concealed.slice(0, winPos), ...concealed.slice(winPos + 1)]

  // 5) 状況
  const open = melds.length > 0
  const method: 'ron' | 'tsumo' =
    options.methodBias === 'ron' ? 'ron' : rng.bool(0.5) ? 'tsumo' : 'ron'
  const riichi = !open && rng.bool(riichiWeight) ? ('立直' as const) : undefined
  const ippatsu = riichi !== undefined && rng.bool(0.35)
  const conditions = [
    open ? '副露あり' : '門前',
    method === 'tsumo' ? 'ツモ和了' : 'ロン和了',
    ...(ippatsu ? ['一発'] : []),
  ]

  // 6) ドラ 0..doraMax 枚（0寄りの重み）。狙った枚数が無理なら 0 枚へフォールバック。
  const want = Math.min(rng.pick([0, 0, 1, 1, 2]), doraMax)
  const indicator =
    doraIndicatorFor(rng, tiles14, want) ??
    doraIndicatorFor(rng, tiles14, 0) ??
    ('1z' as TileCode)

  return {
    hand,
    winningTile: wait.winTile,
    melds,
    context: ctx(rng, {
      method,
      riichi,
      conditions,
      doraIndicators: [indicator],
    }),
  }
}
