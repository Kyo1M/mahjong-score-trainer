# 出題バリエーション拡充＋UI/動線刷新 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ランダム出題の多様化（ブロックビルダー＋符ドリル＋バラエティガード）、役名ネタバレ除去、暖色系フラットUIへの刷新と動線改善（符→翻→支払い、stickyバー、Enterキー）。

**Architecture:** 汎用ブロックビルダー（`hand-builder.ts`）が雀頭＋4面子を部品から組み立て、`generator.ts` はテーマ（制約注入・符ドリル・七対子等）の重み付き抽選と既存 `accept()` フィルタで出題を選別する。UI は `App.tsx` をページ単位に分割し、練習画面の動線を磨く。スコアリングの正しさは従来どおり `@kobalab/majiang-core` が担保。

**Tech Stack:** React 19 + react-router-dom 7 + Vite + Vitest + Testing Library。スタイルは素のCSS（`index.css` / `App.css`）。

**Spec:** `docs/superpowers/specs/2026-06-10-practice-variety-ui-refresh-design.md`

**ブランチ:** `feat/random-practice-engine` から `feat/practice-variety-ui-refresh` を切って作業する。

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/domain/hand-builder.ts` (新規) | 汎用ブロックビルダー。ブロック型・待ち選択・副露化・状況抽選・ドラ指定 (`doraIndicatorFor`)・`ctx`/`countsOk` ヘルパー |
| `src/domain/hand-builder.test.ts` (新規) | ビルダーのプロパティテスト |
| `src/domain/generator.ts` (書換) | テーマ定義（free/simple/ittsu/sanshoku/honitsu/chinitsu/yakuhai/terminal/chiitoitsu/fuDrill）、重み付き抽選、バラエティガード、`yakuSignature` |
| `src/domain/yaku-map.ts` (修正) | 小三元・三色同刻を追加 |
| `src/domain/question-factory.ts` (修正) | タイトルから役名除去、`CONFUSABLE` 追加 |
| `src/App.tsx` (縮小) | ルーティング・セッション状態・ヘッダー（ミニ成績付き）のみ |
| `src/pages/HomePage.tsx` (新規) | 現 `Home` |
| `src/pages/PracticePage.tsx` (新規) | 現 `PracticePage`＋動線変更（符→翻→支払い、難易度セレクタ、stickyバー、Enter） |
| `src/pages/GuidePage.tsx` (新規) | 現 `GuidePage`（コピー移動のみ） |
| `src/pages/guide-labels.ts` (新規) | `guideLabel`（GuidePage と FeedbackPanel が共用） |
| `src/pages/ResultsPage.tsx` (新規) | 現 `ResultsPage` |
| `src/components/AnswerGroup.tsx` (新規) | `AnswerGroup` / `MultiAnswerGroup` |
| `src/components/FeedbackPanel.tsx` (新規) | `FeedbackPanel` / `ResultBadge` / `BreakdownList` |
| `src/pages/PracticePage.test.tsx` (新規) | 動線のコンポーネントテスト |
| `src/index.css` / `src/App.css` (書換) | 暖色系フラットの新スタイル |

---

### Task 1: yaku-map に小三元・三色同刻を追加

**Files:**
- Modify: `src/domain/yaku-map.ts`
- Test: `src/domain/yaku-map.test.ts`（既存に追記）

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/yaku-map.test.ts` の `describe` 内に追記:

```ts
  it('maps 小三元 and 三色同刻', () => {
    expect(mapYakuName('小三元')?.key).toBe('shousangen')
    expect(mapYakuName('三色同刻')?.key).toBe('sanshoku-doukou')
    expect(yakuCatalog['shousangen'].label).toBe('小三元')
    expect(yakuCatalog['sanshoku-doukou'].label).toBe('三色同刻')
  })
```

（ファイル冒頭の import に `yakuCatalog` が無ければ追加: `import { mapYakuName, yakuCatalog } from './yaku-map'`）

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/domain/yaku-map.test.ts`
Expected: FAIL（`shousangen` が undefined）

- [ ] **Step 3: 実装**

`src/domain/yaku-map.ts` の `yakuCatalog` に追加（`honroutou` の行の後）:

```ts
  shousangen: { key: 'shousangen', label: '小三元' },
  'sanshoku-doukou': { key: 'sanshoku-doukou', label: '三色同刻' },
```

`EXACT` に追加（`三暗刻: 'sananko',` の行の後）:

```ts
  小三元: 'shousangen',
  三色同刻: 'sanshoku-doukou',
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/domain/yaku-map.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/domain/yaku-map.ts src/domain/yaku-map.test.ts
git commit -m "feat: add shousangen and sanshoku-doukou to yaku catalog"
```

---

### Task 2: hand-builder（汎用ブロックビルダー）

**Files:**
- Create: `src/domain/hand-builder.ts`
- Test: `src/domain/hand-builder.test.ts`

設計: 雀頭1＋面子4ブロックを組み立てて `ScoreInput | null` を返す（null は矛盾形＝呼び出し側がリトライ）。`generator.ts` から移管するヘルパー（`ctx`/`countsOk`/ドラ表示牌選択）もここに置く。**この時点では generator.ts は変更しない**（Task 4 で切替）。

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/hand-builder.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildRandomHand, doraIndicatorFor, countsOk } from './hand-builder'
import { scoreHand } from './majiang-adapter'
import { createRng } from './rng'
import type { ScoreInput, TileCode } from './types'

function allTiles(input: ScoreInput): TileCode[] {
  return [...input.hand, input.winningTile, ...input.melds.flatMap((m) => m.tiles)]
}

function doraOf(ind: TileCode): string {
  const n = Number(ind[0] === '0' ? 5 : ind[0])
  const suit = ind[1]
  if (suit === 'z') {
    if (n <= 4) return `${(n % 4) + 1}z`
    return `${n === 7 ? 5 : n + 1}z`
  }
  return `${n === 9 ? 1 : n + 1}${suit}`
}

describe('buildRandomHand', () => {
  it('yields structurally consistent 14-tile inputs', () => {
    const rng = createRng(42)
    let built = 0
    for (let i = 0; i < 300; i++) {
      const input = buildRandomHand(rng)
      if (!input) continue
      built++
      const tiles = allTiles(input)
      expect(tiles.length, `iter ${i}`).toBe(14)
      expect(countsOk(tiles), `iter ${i}`).toBe(true)
      // 副露ありなら立直・一発なし
      if (input.melds.some((m) => m.open)) {
        expect(input.context.riichi, `iter ${i}`).toBeUndefined()
        expect(input.context.conditions, `iter ${i}`).not.toContain('一発')
      }
      // conditions と method の整合
      if (input.context.method === 'tsumo') {
        expect(input.context.conditions, `iter ${i}`).not.toContain('ロン和了')
      } else {
        expect(input.context.conditions, `iter ${i}`).not.toContain('ツモ和了')
      }
    }
    // 棄却率が高すぎないこと（半分以上は組めている）
    expect(built).toBeGreaterThan(150)
  })

  it('a meaningful share of built hands are engine-valid winning hands', () => {
    const rng = createRng(7)
    let valid = 0
    let attempts = 0
    for (let i = 0; i < 300; i++) {
      const input = buildRandomHand(rng)
      if (!input) continue
      attempts++
      if (scoreHand(input).valid) valid++
    }
    // 全ブロックは完成形なので和了形は常に成立し、役なしだけが invalid になる。
    // 3割以上が valid なら棄却サンプリングとして実用十分。
    expect(attempts).toBeGreaterThan(0)
    expect(valid / attempts).toBeGreaterThan(0.3)
  })

  it('honors suitPool / allowHonors constraints (chinitsu-style)', () => {
    const rng = createRng(99)
    for (let i = 0; i < 100; i++) {
      const input = buildRandomHand(rng, { suitPool: ['p'], allowHonors: false, openMax: 0 })
      if (!input) continue
      for (const t of allTiles(input)) expect(t[1], `iter ${i}: ${t}`).toBe('p')
      expect(input.melds.length, `iter ${i}`).toBe(0)
    }
  })

  it('includes forcedBlocks in the hand (ittsu-style)', () => {
    const rng = createRng(5)
    for (let i = 0; i < 50; i++) {
      const input = buildRandomHand(rng, {
        forcedBlocks: [
          { kind: 'run', suit: 's', start: 1 },
          { kind: 'run', suit: 's', start: 4 },
          { kind: 'run', suit: 's', start: 7 },
        ],
      })
      if (!input) continue
      const counts = new Map<string, number>()
      for (const t of allTiles(input)) counts.set(t, (counts.get(t) ?? 0) + 1)
      for (let n = 1; n <= 9; n++) {
        expect(counts.get(`${n}s`) ?? 0, `iter ${i}: ${n}s`).toBeGreaterThanOrEqual(1)
      }
    }
  })
})

describe('doraIndicatorFor', () => {
  it('returns an indicator that points at exactly N tiles in the hand', () => {
    const rng = createRng(3)
    const hand: TileCode[] = ['2m', '3m', '4m', '3p', '4p', '5p', '4s', '5s', '6s', '7p', '8p', '9p', '2z', '2z']
    for (const want of [0, 1, 2]) {
      const ind = doraIndicatorFor(rng, hand, want)
      if (!ind) continue // その枚数を満たす表示牌が無い場合は null 許容
      const dora = doraOf(ind)
      const count = hand.filter((t) => (t[0] === '0' ? `5${t[1]}` : t) === dora).length
      expect(count, `want ${want}, ind ${ind}`).toBe(want)
    }
    // want=0 は実用上ほぼ常に存在する
    expect(doraIndicatorFor(rng, hand, 0)).not.toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/domain/hand-builder.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: 実装**

`src/domain/hand-builder.ts`:

```ts
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
  methodBias?: 'ron'       // ロン固定（符ドリル用: 門前ロン10符を狙う）
}

const HONORS: TileCode[] = ['1z', '2z', '3z', '4z', '5z', '6z', '7z']

export function blockTiles(block: Block): TileCode[] {
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
  if (winPos < 0) return null // 形の都合で取り出せない（保険）
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/domain/hand-builder.test.ts`
Expected: PASS（4テスト）

valid率が0.3を下回る場合は `riichiWeight` の既定値を上げる（0.55→0.65）か、`openMax` 既定を1にする調整を行い、コメントに理由を残す。

- [ ] **Step 5: コミット**

```bash
git add src/domain/hand-builder.ts src/domain/hand-builder.test.ts
git commit -m "feat: generic block-based hand builder with wait/meld/dora control"
```

---

### Task 3: generator をテーマ抽選に書き換え（符ドリル・バラエティガード込み）

**Files:**
- Modify: `src/domain/generator.ts`（全面書換）
- Test: `src/domain/generator.test.ts`（追記）

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/generator.test.ts` に import を追加し、describe を追記:

```ts
import { generate, yakuSignature, __themesForTest } from './generator'
```

```ts
describe('generate (variety)', () => {
  it('mix yields at least 10 distinct yaku kinds across 200 questions', () => {
    const rng = createRng(2026)
    const kinds = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const { result } = generate('mix', rng)
      for (const y of result.yaku) {
        if (!y.isDora) kinds.add(mapYakuName(y.name)!.key)
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(10)
  })

  it('mix yields some 50fu+ questions below mangan (fu drills)', () => {
    const rng = createRng(777)
    let highFu = 0
    for (let i = 0; i < 200; i++) {
      const { result } = generate('mix', rng)
      if (!result.isLimit && (result.fu ?? 0) >= 50) highFu++
    }
    expect(highFu).toBeGreaterThan(0)
  })

  it('fu drill builds land between 50 and 70 fu when accepted', () => {
    const rng = createRng(4242)
    let accepted = 0
    for (let i = 0; i < 300 && accepted < 20; i++) {
      const input = __themesForTest.fuDrill.build(rng)
      if (!input) continue
      const result = scoreHand(input)
      if (!result.valid || result.isLimit || (result.fu ?? 0) < 50) continue
      accepted++
      expect(result.fu, `iter ${i}`).toBeLessThanOrEqual(70)
    }
    expect(accepted).toBeGreaterThan(0)
  })

  it('avoid signatures suppress immediate repeats (best effort)', () => {
    const rng = createRng(31337)
    let prev = ''
    let repeats = 0
    for (let i = 0; i < 100; i++) {
      const { result } = generate('mix', rng, { avoid: prev ? [prev] : [] })
      const sig = yakuSignature(result)
      if (sig === prev) repeats++
      prev = sig
    }
    // フォールバックパスはガードを無視するので 0 とは限らないが、ほぼ抑止される
    expect(repeats).toBeLessThanOrEqual(2)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/domain/generator.test.ts`
Expected: FAIL（`yakuSignature` が未エクスポート。既存2テストは現実装でPASSのまま）

- [ ] **Step 3: generator.ts を書き換える**

`src/domain/generator.ts` 全文（旧アーキタイプ10種・重複ヘルパーは削除）:

```ts
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
```

- [ ] **Step 4: 全ドメインテストが通ることを確認**

Run: `npm test`
Expected: PASS（既存の generator プロパティテスト・difficulty フィルタテスト・question-factory テスト含む全件）

落ちた場合の調整指針（コメントを残して調整すること）:
- starter 収束が遅い/失敗 → `simple` の `riichiWeight` を下げる（`buildRandomHand` 呼び出しに `riichiWeight: 0.35` を追加。立直+ツモ+平和で3翻を超えやすいため）
- limit 収束が遅い → `chinitsu`/`honitsu` テーマの `doraMax` を 2 のまま、`riichiWeight: 0.8` を追加
- 50fu+ が出ない → `fuDrill` の weight を 7→10 に

- [ ] **Step 5: コミット**

```bash
git add src/domain/generator.ts src/domain/generator.test.ts
git commit -m "feat: theme-based generator with fu drills and variety guard"
```

---

### Task 4: question-factory のネタバレ除去と CONFUSABLE 追加

**Files:**
- Modify: `src/domain/question-factory.ts`
- Test: `src/domain/question-factory.test.ts`（追記）

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/question-factory.test.ts` に追記:

```ts
import { yakuCatalog } from './yaku-map'
```

```ts
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
```

注意: 役ラベル「白」「發」「中」は1文字なので、タイトル/プロンプトの定型文にこれらの字が含まれないこと（上の定型文は含まない）。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/domain/question-factory.test.ts`
Expected: FAIL（現タイトルは「○○を含む手」）

- [ ] **Step 3: 実装**

`src/domain/question-factory.ts` の `buildQuestion` 内、`return` 直前の `const yakuText = ...` は残し、`return` オブジェクトの `title` と `prompt` を変更:

```ts
  const role = input.context.dealer ? '親' : '子'
  const methodLabel = input.context.method === 'ron' ? 'ロン' : 'ツモ'
  return {
    id: `gen-${difficulty}-${seed}-${result.han}-${result.fu ?? 'L'}-${result.defen}`,
    title: `${role}の${methodLabel}和了`,
    difficulty,
    prompt: '成立した役・符・翻・支払いを選んでください。',
```

あわせて `explanation` の表記順を符→翻に変更（同関数内）:

```ts
    explanation:
      `成立した役は${yakuText}です。${doraNote(input)}` +
      (fuRequired
        ? `${result.fu}符${result.han}翻で、${payment.label}になります。`
        : `${result.han}翻以上の満貫クラスで、${payment.label}になります。`),
```

`CONFUSABLE` を拡張（既存エントリは維持し、以下を追加）:

```ts
const CONFUSABLE: Record<string, string[]> = {
  pinfu: ['tanyao', 'iipeiko', 'sanshoku'],
  tanyao: ['pinfu', 'sanshoku', 'iipeiko'],
  honitsu: ['chinitsu', 'chanta', 'junchan'],
  chinitsu: ['honitsu', 'ittsu'],
  toitoi: ['sananko', 'honroutou'],
  sananko: ['toitoi'],
  chiitoitsu: ['toitoi', 'iipeiko', 'ryanpeiko'],
  iipeiko: ['ryanpeiko', 'pinfu', 'sanshoku'],
  ryanpeiko: ['iipeiko', 'chiitoitsu'],
  ittsu: ['sanshoku', 'chinitsu', 'honitsu'],
  sanshoku: ['sanshoku-doukou', 'ittsu', 'pinfu'],
  'sanshoku-doukou': ['sanshoku', 'toitoi', 'sananko'],
  chanta: ['junchan', 'honroutou'],
  junchan: ['chanta', 'chinitsu'],
  honroutou: ['toitoi', 'chanta', 'chiitoitsu'],
  shousangen: ['yakuhai-haku', 'yakuhai-hatsu', 'yakuhai-chun', 'honroutou'],
  'yakuhai-bakaze': ['yakuhai-jikaze'],
  'yakuhai-jikaze': ['yakuhai-bakaze'],
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全件。`golden.test.ts`/`scoring.test.ts` は静的問題集ベースなので影響なし）

- [ ] **Step 5: コミット**

```bash
git add src/domain/question-factory.ts src/domain/question-factory.test.ts
git commit -m "feat: spoiler-free question titles, fu-first copy, richer confusables"
```

---

### Task 5: App.tsx をページ単位に分割（挙動不変リファクタ＋ガード接続）

**Files:**
- Modify: `src/App.tsx`（縮小）
- Create: `src/pages/HomePage.tsx`, `src/pages/PracticePage.tsx`, `src/pages/GuidePage.tsx`, `src/pages/ResultsPage.tsx`, `src/pages/guide-labels.ts`
- Create: `src/components/AnswerGroup.tsx`, `src/components/FeedbackPanel.tsx`

挙動を変えない移動が主体。唯一の機能追加は `makeQuestion` へのバラエティガード接続。**移動はコピペで行い、ロジックを書き換えないこと。**

- [ ] **Step 1: コンポーネントを移動する**

1. `src/components/AnswerGroup.tsx` — `App.tsx` から `AnswerGroupProps` / `AnswerGroup` / `MultiAnswerGroupProps` / `MultiAnswerGroup`（App.tsx:419-493）を移動し `export` を付ける。import は `import type { AnswerChoice } from '../domain/types'`
2. `src/components/FeedbackPanel.tsx` — `FeedbackPanel` / `ResultBadge` / `BreakdownList` / `yakuLabels`（App.tsx:495-583, 809-812）を移動。import: `react-router-dom` の `Link`、`../domain/types` の型
3. `src/pages/GuidePage.tsx` — `GuidePage` / `InfoCard` を移動。`guideLabel` は GuidePage と FeedbackPanel の両方が使うため、新規 `src/pages/guide-labels.ts` に移して `export` する（コンポーネントファイルに非コンポーネント export を混ぜると `react-refresh/only-export-components` の lint に当たるため）。`InfoCard` / `ResultBadge` / `BreakdownList` / `yakuLabels` は各ファイル内のモジュールプライベートに留め、export しない
4. `src/pages/HomePage.tsx` — `Home`（`HomePage` にリネーム）
5. `src/pages/ResultsPage.tsx` — `ResultsPage` / `Stat`
6. `src/pages/PracticePage.tsx` — `PracticePage` / `DifficultyFilterBar` / `ContextPanel` / `toggleKey` / `emptyAnswer`
7. 各ページは named export（`export function HomePage(...)` 等）

- [ ] **Step 2: App.tsx を縮小し、バラエティガードを接続する**

新しい `src/App.tsx` 全文:

```tsx
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { calculateStats } from './domain/scoring'
import { generate, yakuSignature } from './domain/generator'
import { buildQuestion } from './domain/question-factory'
import { createRng } from './domain/rng'
import { HomePage } from './pages/HomePage'
import { PracticePage } from './pages/PracticePage'
import { GuidePage } from './pages/GuidePage'
import { ResultsPage } from './pages/ResultsPage'
import type {
  AnswerEvaluation, CompletedQuestion, DifficultyFilter, PracticeQuestion,
} from './domain/types'

const storageKey = 'mahjong-score-trainer-session-v3'

type StoredSession = {
  difficulty: DifficultyFilter
  completed: CompletedQuestion[]
}

function loadSession(): StoredSession {
  const raw = window.sessionStorage.getItem(storageKey)
  if (!raw) return { difficulty: 'mix', completed: [] }
  try {
    const parsed = JSON.parse(raw) as StoredSession
    return {
      difficulty: parsed.difficulty ?? 'mix',
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
    }
  } catch {
    return { difficulty: 'mix', completed: [] }
  }
}

function App() {
  const [session, setSession] = useState<StoredSession>(() => loadSession())
  // 直近2問の役構成。同じ構成の連続出題を抑止する（ベストエフォート）。
  const recentSignaturesRef = useRef<string[]>([])

  function makeQuestion(difficulty: DifficultyFilter): PracticeQuestion {
    const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
    const rng = createRng(seed)
    const { input, result } = generate(difficulty, rng, {
      avoid: recentSignaturesRef.current,
    })
    recentSignaturesRef.current = [
      yakuSignature(result),
      ...recentSignaturesRef.current,
    ].slice(0, 2)
    return buildQuestion({ ...input }, result, rng)
  }

  const [question, setQuestion] = useState<PracticeQuestion>(() =>
    makeQuestion(loadSession().difficulty),
  )

  useEffect(() => {
    window.sessionStorage.setItem(storageKey, JSON.stringify(session))
  }, [session])

  function resetSession() {
    setSession((s) => ({ difficulty: s.difficulty, completed: [] }))
  }

  function setDifficulty(difficulty: DifficultyFilter) {
    setSession((s) => ({ ...s, difficulty }))
    setQuestion(makeQuestion(difficulty))
  }

  function recordAnswer(evaluation: AnswerEvaluation, elapsedMs: number) {
    setSession((current) => ({
      ...current,
      completed: [
        ...current.completed,
        {
          questionId: question.id,
          fuRequired: question.fuRequired,
          evaluation,
          elapsedMs,
          answeredAt: new Date().toISOString(),
        },
      ],
    }))
  }

  function advanceQuestion() {
    setQuestion(makeQuestion(session.difficulty))
  }

  const stats = useMemo(() => calculateStats(session.completed), [session.completed])

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand__mark">点</span>
          <span>
            <strong>Mahjong Score Trainer</strong>
            <small>麻雀の点数計算をやさしく練習</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="メインナビゲーション">
          <NavLink to="/practice">練習</NavLink>
          <NavLink to="/guide">ガイド</NavLink>
          <NavLink to="/results">結果</NavLink>
        </nav>
      </header>

      <Routes>
        <Route
          path="/"
          element={<HomePage completed={session.completed.length} onReset={resetSession} />}
        />
        <Route
          path="/practice"
          element={
            <PracticePage
              key={question.id}
              question={question}
              completedCount={session.completed.length}
              difficulty={session.difficulty}
              onSetDifficulty={setDifficulty}
              onAnswered={recordAnswer}
              onNext={advanceQuestion}
            />
          }
        />
        <Route path="/guide" element={<GuidePage />} />
        <Route
          path="/results"
          element={<ResultsPage stats={stats} onReset={resetSession} />}
        />
      </Routes>
    </div>
  )
}

export default App
```

（ヘッダーのミニ成績は Task 8 で追加する。`stats` はこの時点では ResultsPage 用のみ）

注意: `makeQuestion` は `useState` 初期化関数からも呼ばれ、StrictMode の二重実行で ref に2回 push されるが、avoid リストが少し厳しくなるだけで無害。コメントを残すこと。

- [ ] **Step 3: ビルドとテストで挙動不変を確認**

Run: `npm run lint && npm test && npm run build`
Expected: すべて成功（コンポーネントの見た目・挙動は不変）

- [ ] **Step 4: dev サーバで簡易確認**

Run: `npm run dev` → ブラウザでホーム/練習/ガイド/結果を巡回し、出題→採点→次の問題が回ることを確認

- [ ] **Step 5: コミット**

```bash
git add src/App.tsx src/pages src/components
git commit -m "refactor: split App.tsx into pages, wire variety guard into question flow"
```

---

### Task 6: 練習画面の動線 — 符→翻→支払い・難易度セレクタ・タイトル表示

**Files:**
- Modify: `src/pages/PracticePage.tsx`
- Test: `src/pages/PracticePage.test.tsx`（新規）

- [ ] **Step 1: 失敗するテストを書く**

`src/pages/PracticePage.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PracticePage } from './PracticePage'
import { practiceQuestions } from '../domain/questions'
import type { DifficultyFilter } from '../domain/types'

beforeAll(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

function renderPage() {
  const props = {
    question: practiceQuestions[0], // q-pinfu-ron-30-4-child（正解: 立直・断幺九・平和 / 30符 / 4翻 / 7700点）
    completedCount: 0,
    difficulty: 'mix' as DifficultyFilter,
    onSetDifficulty: vi.fn(),
    onAnswered: vi.fn(),
    onNext: vi.fn(),
  }
  render(
    <MemoryRouter>
      <PracticePage {...props} />
    </MemoryRouter>,
  )
  return props
}

// 正解を一通り選ぶヘルパー（以降のテストでも使う）
async function answerCanonical(user: ReturnType<typeof userEvent.setup>) {
  for (const label of ['立直', '断幺九', '平和', '30符', '4翻', '7700点']) {
    await user.click(screen.getByRole('button', { name: label }))
  }
}

describe('PracticePage layout', () => {
  it('renders fu before han in the answer grid', () => {
    renderPage()
    const legends = [...document.querySelectorAll('.answer-grid legend')].map(
      (el) => el.textContent,
    )
    expect(legends[0]).toBe('符')
    expect(legends[1]).toBe('翻 / 役満')
  })

  it('shows the spoiler-free title and a compact difficulty selector', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      practiceQuestions[0].title,
    )
    await user.selectOptions(screen.getByLabelText('難易度'), 'starter')
    expect(props.onSetDifficulty).toHaveBeenCalledWith('starter')
  })

  it('grades the canonical answer as complete-correct', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await answerCanonical(user)
    await user.click(screen.getByRole('button', { name: /採点する/ }))
    expect(props.onAnswered).toHaveBeenCalledOnce()
    expect(screen.getByText('すべて正解です！')).toBeInTheDocument()
  })
})
```

注: `practiceQuestions[0]` のタイトルは静的問題集の値（`平和ロンは30符で止める`）なので、このテストの heading 検証は「`question.title` をそのまま表示する」ことの検証。ネタバレ除去自体は Task 4 のドメインテストが担保する。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/pages/PracticePage.test.tsx`
Expected: FAIL（legend 順が 翻→符、難易度セレクタ不在）

- [ ] **Step 3: PracticePage を書き換える**

`src/pages/PracticePage.tsx` 全文:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DoraView, HandView } from '../components/TileView'
import { AnswerGroup, MultiAnswerGroup } from '../components/AnswerGroup'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { evaluateAnswer } from '../domain/scoring'
import { difficultyLabel } from '../domain/difficulty-label'
import type {
  AnswerEvaluation, DifficultyFilter, PracticeQuestion, UserAnswer,
} from '../domain/types'

const emptyAnswer: UserAnswer = { yakuKeys: [], hanKey: null, fuKey: null, paymentKey: null }

const DIFFICULTY_FILTERS: DifficultyFilter[] = ['mix', 'starter', 'standard', 'advanced', 'limit']

type PracticePageProps = {
  question: PracticeQuestion
  completedCount: number
  difficulty: DifficultyFilter
  onSetDifficulty: (d: DifficultyFilter) => void
  onAnswered: (evaluation: AnswerEvaluation, elapsedMs: number) => void
  onNext: () => void
}

export function PracticePage({
  question,
  completedCount,
  difficulty,
  onSetDifficulty,
  onAnswered,
  onNext,
}: PracticePageProps) {
  const navigate = useNavigate()
  const [answer, setAnswer] = useState<UserAnswer>(emptyAnswer)
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null)
  const [startedAt] = useState(() => performance.now())
  const [questionNumber] = useState(() => completedCount + 1)

  // 問題ごとに再マウントされるので、新しい問題は画面の一番上から始める。
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const canSubmit =
    answer.yakuKeys.length > 0 &&
    answer.hanKey !== null &&
    answer.paymentKey !== null &&
    (question.fuRequired ? answer.fuKey !== null : true)

  function submitAnswer() {
    if (!canSubmit || evaluation) {
      return
    }

    const selectedAnswer = question.fuRequired
      ? answer
      : { ...answer, fuKey: 'not-needed' }
    const result = evaluateAnswer(question, selectedAnswer)
    setEvaluation(result)
    onAnswered(result, performance.now() - startedAt)
  }

  function revealAnswer() {
    if (evaluation) {
      return
    }

    const result = evaluateAnswer(question, {
      hanKey: null,
      yakuKeys: [],
      fuKey: question.fuRequired ? null : 'not-needed',
      paymentKey: null,
    })
    setEvaluation(result)
    onAnswered(result, performance.now() - startedAt)
  }

  return (
    <main className="practice-page">
      <section className="practice-card">
        <div className="practice-card__topline">
          <div>
            <p className="eyebrow">第 {questionNumber} 問</p>
            <h1>{question.title}</h1>
          </div>
          <div className="practice-card__meta">
            <span className={`difficulty difficulty--${question.difficulty}`}>
              {difficultyLabel(question.difficulty)}
            </span>
            <label className="difficulty-select">
              難易度
              <select
                value={difficulty}
                onChange={(event) =>
                  onSetDifficulty(event.target.value as DifficultyFilter)
                }
              >
                {DIFFICULTY_FILTERS.map((d) => (
                  <option key={d} value={d}>
                    {difficultyLabel(d)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <p className="prompt">{question.prompt}</p>
        <ContextPanel question={question} />
        <HandView
          tiles={question.hand}
          winningTile={question.winningTile}
          melds={question.melds}
          riichi={question.context.riichi}
        />

        <div className="yaku-answer-block">
          <MultiAnswerGroup
            title="成立した役（複数選べます）"
            choices={question.options.yaku}
            selectedKeys={answer.yakuKeys}
            onToggle={(yakuKey) =>
              setAnswer((current) => ({
                ...current,
                yakuKeys: toggleKey(current.yakuKeys, yakuKey),
              }))
            }
            disabled={evaluation !== null}
          />
        </div>

        <div className="answer-grid">
          <AnswerGroup
            title="符"
            choices={
              question.fuRequired
                ? question.options.fu.filter((choice) => choice.key !== 'not-needed')
                : [{ key: 'not-needed', label: '符の計算は不要です' }]
            }
            selectedKey={question.fuRequired ? answer.fuKey : 'not-needed'}
            onSelect={(fuKey) => setAnswer((current) => ({ ...current, fuKey }))}
            disabled={evaluation !== null || !question.fuRequired}
          />
          <AnswerGroup
            title="翻 / 役満"
            choices={question.options.han}
            selectedKey={answer.hanKey}
            onSelect={(hanKey) => setAnswer((current) => ({ ...current, hanKey }))}
            disabled={evaluation !== null}
          />
          <AnswerGroup
            title={question.context.method === 'ron' ? 'ロン支払い' : 'ツモ支払い'}
            choices={question.options.payment}
            selectedKey={answer.paymentKey}
            onSelect={(paymentKey) =>
              setAnswer((current) => ({ ...current, paymentKey }))
            }
            disabled={evaluation !== null}
          />
        </div>

        <div className="practice-actions">
          {evaluation === null && (
            <>
              <button
                className="button button--primary"
                type="button"
                onClick={submitAnswer}
                disabled={!canSubmit}
              >
                採点する
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={revealAnswer}
              >
                答えを見る
              </button>
            </>
          )}
          <button
            className="practice-end"
            type="button"
            onClick={() => navigate('/results')}
          >
            終了して結果へ
          </button>
        </div>

        {evaluation && (
          <FeedbackPanel question={question} evaluation={evaluation} />
        )}
      </section>
    </main>
  )
}

type ContextPanelProps = {
  question: PracticeQuestion
}

function ContextPanel({ question }: ContextPanelProps) {
  const context = question.context
  return (
    <section className="context-panel" aria-label="問題条件">
      <span>{context.dealer ? '親' : '子'}</span>
      <span>{context.method === 'ron' ? 'ロン' : 'ツモ'}</span>
      <span>場風 {context.roundWind}</span>
      <span>自風 {context.seatWind}</span>
      {context.conditions.map((condition) => (
        <span key={condition}>{condition}</span>
      ))}
      <span className="context-panel__dora">
        ドラ表示
        <DoraView tiles={context.doraIndicators} />
      </span>
    </section>
  )
}

function toggleKey(keys: string[], key: string): string[] {
  return keys.includes(key)
    ? keys.filter((current) => current !== key)
    : [...keys, key]
}
```

あわせて `src/components/FeedbackPanel.tsx` から `onNext` prop と `feedback-panel__actions` の「次の問題へ」ボタンを削除する（次タスクの sticky バーに一本化するため。この時点では採点後に「次の問題へ」が無くなるが、Task 7 で復活する。`FeedbackPanelProps` から `onNext` を消し、呼び出し側も合わせる）。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/pages/PracticePage.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/pages/PracticePage.tsx src/pages/PracticePage.test.tsx src/components/FeedbackPanel.tsx
git commit -m "feat: fu-first answer grid, compact difficulty selector, spoiler-free heading"
```

---

### Task 7: 採点後の sticky バー・自動スクロール・Enter キー

**Files:**
- Modify: `src/pages/PracticePage.tsx`
- Test: `src/pages/PracticePage.test.tsx`（追記）

- [ ] **Step 1: 失敗するテストを書く**

`src/pages/PracticePage.test.tsx` に describe を追記:

```tsx
describe('PracticePage grading flow', () => {
  it('shows a sticky next bar after grading and advances on click', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await answerCanonical(user)
    await user.click(screen.getByRole('button', { name: /採点する/ }))

    const next = screen.getByRole('button', { name: /次の問題へ/ })
    expect(next.closest('.sticky-bar')).not.toBeNull()
    await user.click(next)
    expect(props.onNext).toHaveBeenCalledOnce()
  })

  it('scrolls to the feedback panel after grading', async () => {
    const user = userEvent.setup()
    renderPage()
    const spy = vi.mocked(window.HTMLElement.prototype.scrollIntoView)
    spy.mockClear()
    await answerCanonical(user)
    await user.click(screen.getByRole('button', { name: /採点する/ }))
    expect(spy).toHaveBeenCalled()
  })

  it('Enter submits when answerable and advances after grading', async () => {
    const user = userEvent.setup()
    const props = renderPage()

    // 未回答時の Enter は何もしない
    await user.keyboard('{Enter}')
    expect(props.onAnswered).not.toHaveBeenCalled()

    await answerCanonical(user)
    await user.keyboard('{Enter}') // 採点
    expect(props.onAnswered).toHaveBeenCalledOnce()

    await user.keyboard('{Enter}') // 次の問題へ
    expect(props.onNext).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/pages/PracticePage.test.tsx`
Expected: FAIL（sticky バー・Enter ハンドラ未実装）

- [ ] **Step 3: 実装**

`src/pages/PracticePage.tsx` に追加。

import を更新: `import { useEffect, useRef, useState } from 'react'`

コンポーネント内に ref と2つの effect を追加（`questionNumber` の `useState` の直後）:

```tsx
  const feedbackRef = useRef<HTMLDivElement>(null)

  // 採点したら解説へスクロールする。
  useEffect(() => {
    if (evaluation) {
      feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [evaluation])

  // Enter: 未採点なら採点、採点後は次の問題へ。
  // 選択肢ボタンのトグルは Space に譲る（Enter は常に進行操作）。
  // 依存が毎レンダー変わるため、依存配列なしで毎回貼り直す。
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' || event.isComposing) return
      const el = document.activeElement
      if (el instanceof HTMLSelectElement || el instanceof HTMLAnchorElement) return
      event.preventDefault()
      if (evaluation) {
        onNext()
      } else {
        submitAnswer()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
```

採点ボタンに Enter ヒントを追加:

```tsx
              <button
                className="button button--primary"
                type="button"
                onClick={submitAnswer}
                disabled={!canSubmit}
              >
                採点する <kbd>Enter</kbd>
              </button>
```

FeedbackPanel を ref 付きラッパで包み、その後に sticky バーを追加（`</section>` の直前まで）:

```tsx
        {evaluation && (
          <div ref={feedbackRef}>
            <FeedbackPanel question={question} evaluation={evaluation} />
          </div>
        )}
      </section>

      {evaluation && (
        <div className="sticky-bar" role="status">
          <span className="sticky-bar__summary">
            {evaluation.completeCorrect
              ? 'すべて正解！'
              : `正解: ${canonicalSummary(question)}`}
          </span>
          <button className="button button--primary" type="button" onClick={onNext}>
            次の問題へ <kbd>Enter</kbd>
          </button>
        </div>
      )}
    </main>
```

ファイル末尾にヘルパーを追加:

```tsx
function canonicalSummary(question: PracticeQuestion): string {
  const c = question.canonicalInterpretation
  const fuPart = question.fuRequired ? c.fuLabel : ''
  return `${fuPart}${c.hanLabel} ${c.paymentLabel}`
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/pages/PracticePage.test.tsx && npm test`
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add src/pages/PracticePage.tsx src/pages/PracticePage.test.tsx
git commit -m "feat: sticky next bar, auto-scroll to feedback, Enter-to-advance"
```

---

### Task 8: ヘッダーのミニ成績表示

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 実装**

`src/App.tsx` のヘッダーの `<nav>` の直前に追加:

```tsx
        {stats.total > 0 && (
          <span className="session-chip" aria-label="今回の成績">
            {stats.total}問・正解{stats.completeCorrect}
          </span>
        )}
```

- [ ] **Step 2: 確認**

Run: `npm run lint && npm test && npm run build`
Expected: 成功。`npm run dev` で1問解くとヘッダーに「1問・正解1」等が出ることを目視確認。

- [ ] **Step 3: コミット**

```bash
git add src/App.tsx
git commit -m "feat: session mini stats in the header"
```

---

### Task 9: ビジュアル刷新（index.css / App.css 書き換え）

**Files:**
- Modify: `src/index.css`（全文置換）
- Modify: `src/App.css`（全文置換）

スタイルのみの変更。自動テストは変更不要（クラス名は不変、削除は `difficulty-bar` / `difficulty-chip` / `feedback-panel__actions` のみで、いずれも前タスクまでに参照が消えている）。

- [ ] **Step 1: index.css を置換**

```css
:root {
  --bg: #f7f1e3;
  --table: #2e6e4e;
  --surface: #fffdf8;
  --line: #e6dcc3;
  --text: #3a3122;
  --muted: #6b5d41;
  --brass: #a86e1d;
  --brass-strong: #8a5a16;
  --tile-face: #fff8e8;
  --tile-edge: #cdb88e;
  --correct: #257b55;
  --incorrect: #b94a3f;
  --shadow: 0 6px 20px rgba(77, 55, 25, 0.07);
  color: var(--text);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  font-synthesis: none;
  line-height: 1.5;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

html {
  background: var(--bg);
  min-height: 100%;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100svh;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

button:focus-visible,
a:focus-visible,
select:focus-visible {
  outline: 3px solid rgba(168, 110, 29, 0.72);
  outline-offset: 2px;
}
```

- [ ] **Step 2: App.css を置換**

```css
.app-shell {
  min-height: 100svh;
}

/* ---------- ヘッダー ---------- */

.site-header {
  align-items: center;
  background: rgba(247, 241, 227, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 12px clamp(18px, 4vw, 48px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand {
  align-items: center;
  color: var(--text);
  display: inline-flex;
  gap: 10px;
  text-decoration: none;
}

.brand__mark {
  align-items: center;
  background: var(--brass);
  border-radius: 10px;
  color: #fffaf0;
  display: grid;
  font-weight: 900;
  height: 40px;
  place-items: center;
  width: 40px;
}

.brand strong,
.brand small {
  display: block;
}

.brand strong {
  font-size: 0.95rem;
}

.brand small {
  color: var(--muted);
  font-size: 0.72rem;
  margin-top: 2px;
}

.session-chip {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  margin-left: auto;
  padding: 6px 12px;
  white-space: nowrap;
}

.site-nav {
  align-items: center;
  display: flex;
  gap: 4px;
}

.site-nav a {
  border-radius: 8px;
  color: var(--muted);
  padding: 8px 12px;
  text-decoration: none;
}

.site-nav a.active,
.site-nav a:hover {
  background: rgba(168, 110, 29, 0.1);
  color: var(--text);
}

/* ---------- ページ共通 ---------- */

.home,
.practice-page,
.results-page,
.guide-page {
  margin: 0 auto;
  max-width: 1100px;
  padding: clamp(22px, 4vw, 48px) clamp(16px, 4vw, 40px);
}

.practice-page {
  padding-bottom: 130px; /* sticky バーと重ならない余白 */
}

.hero-card,
.practice-card,
.results-card,
.guide-hero,
.resume-card,
.guide-section {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow);
}

.hero-card,
.results-card,
.guide-hero {
  padding: clamp(26px, 5vw, 52px);
}

.eyebrow {
  color: var(--brass);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  margin: 0 0 8px;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  color: var(--text);
  font-size: clamp(1.6rem, 4vw, 2.6rem);
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin-bottom: 16px;
  max-width: 880px;
}

h2 {
  color: var(--text);
  font-size: clamp(1.2rem, 2.6vw, 1.6rem);
  letter-spacing: -0.02em;
}

h3 {
  color: var(--text);
  font-size: 1rem;
}

.lead,
.prompt {
  color: var(--muted);
  font-size: clamp(0.98rem, 1.8vw, 1.08rem);
  line-height: 1.8;
  max-width: 760px;
}

/* ---------- ボタン ---------- */

.hero-actions,
.practice-actions,
.resume-card__actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.button {
  align-items: center;
  background: none;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-weight: 800;
  gap: 8px;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.button--primary {
  background: var(--brass);
  color: #fffaf0;
}

.button--primary:hover:not(:disabled) {
  background: var(--brass-strong);
}

.button--ghost {
  background: var(--surface);
  border-color: var(--line);
  color: var(--text);
}

.button--ghost:hover:not(:disabled) {
  border-color: var(--brass);
}

.button--large {
  font-size: 1.05rem;
  min-height: 56px;
  padding: 0 40px;
  width: min(100%, 420px);
}

kbd {
  background: rgba(255, 255, 255, 0.22);
  border-radius: 5px;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 6px;
}

.button--ghost kbd {
  background: rgba(58, 49, 34, 0.1);
}

.home-cta-bottom {
  display: flex;
  justify-content: center;
  margin-top: clamp(24px, 4vw, 40px);
}

/* ---------- ホーム ---------- */

.feature-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18px;
}

.feature-card,
.info-card,
.stat {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px;
}

.feature-card span {
  color: var(--brass);
  font-weight: 900;
}

.feature-card p,
.info-card p {
  color: var(--muted);
  line-height: 1.7;
  margin-bottom: 0;
}

.resume-card {
  align-items: center;
  display: flex;
  gap: 20px;
  justify-content: space-between;
  margin-top: 18px;
  padding: 22px;
}

.resume-card p {
  color: var(--muted);
  margin-bottom: 0;
}

/* ---------- 練習画面 ---------- */

.practice-card {
  padding: clamp(18px, 3.5vw, 32px);
}

.practice-card__topline {
  align-items: start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.practice-card h1 {
  font-size: clamp(1.5rem, 3.4vw, 2.1rem);
  margin-bottom: 8px;
}

.practice-card__meta {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.difficulty {
  border: 1px solid var(--line);
  border-radius: 999px;
  flex: 0 0 auto;
  font-size: 0.85rem;
  font-weight: 800;
  padding: 7px 12px;
}

.difficulty--starter {
  color: var(--correct);
}

.difficulty--standard {
  color: var(--brass);
}

.difficulty--advanced,
.difficulty--limit {
  color: var(--incorrect);
}

.difficulty-select {
  align-items: center;
  color: var(--muted);
  display: inline-flex;
  font-size: 0.85rem;
  gap: 6px;
}

.difficulty-select select {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-size: 0.85rem;
  min-height: 36px;
  padding: 4px 8px;
}

.context-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 18px 0;
}

.context-panel > span {
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  display: inline-flex;
  font-size: 0.88rem;
  gap: 8px;
  min-height: 34px;
  padding: 4px 12px;
}

.context-panel__dora {
  padding-right: 6px;
}

.dora-view {
  align-items: center;
  display: inline-flex;
  gap: 3px;
}

.hand-view__riichi {
  display: flex;
  margin-bottom: 12px;
}

.riichi-stick {
  align-items: center;
  display: inline-flex;
  gap: 8px;
}

.riichi-stick__bar {
  height: auto;
  width: 88px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
}

.riichi-stick__label {
  color: rgba(255, 252, 244, 0.94);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.hand-view {
  background: var(--table);
  border: 1px solid rgba(93, 66, 25, 0.2);
  border-radius: 12px;
  margin: 18px 0;
  overflow: auto;
  padding: 16px;
}

.tile-row {
  align-items: end;
  display: flex;
  gap: clamp(2px, 0.9vw, 6px);
}

.tile-row--hand {
  min-width: max-content;
}

.tile {
  background: var(--tile-face);
  border: 1px solid rgba(84, 57, 20, 0.22);
  border-radius: 6px;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.22),
    inset 0 -4px 0 var(--tile-edge);
  display: inline-flex;
  padding: 2px;
}

.tile img {
  background: transparent;
  display: block;
  height: auto;
  width: clamp(27px, 7vw, 44px);
}

.tile--compact img {
  width: 28px;
}

.tile--winning {
  margin-left: clamp(8px, 2vw, 16px);
  outline: 3px solid rgba(255, 219, 134, 0.96);
  outline-offset: 2px;
}

.melds {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.meld {
  align-items: center;
  background: rgba(255, 250, 232, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  display: inline-flex;
  gap: 10px;
  padding: 8px 10px;
}

.meld__label {
  color: #fff0cb;
  font-size: 0.82rem;
  font-weight: 800;
}

/* ---------- 回答欄 ---------- */

.answer-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.yaku-answer-block {
  margin-bottom: 14px;
}

.answer-group {
  border: 1px solid var(--line);
  border-radius: 12px;
  margin: 0;
  padding: 14px;
}

.answer-group legend {
  color: var(--brass);
  font-weight: 900;
  padding: 0 8px;
}

.answer-group__hint {
  color: var(--muted);
  font-size: 0.88rem;
  margin: 0 0 12px;
}

.choice-list {
  display: grid;
  gap: 8px;
}

.choice-list--multi {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.choice {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  min-height: 46px;
  padding: 10px 12px;
  text-align: left;
}

.choice span,
.choice small {
  display: block;
}

.choice small {
  color: var(--muted);
  margin-top: 3px;
}

.choice:hover:not(:disabled),
.choice--selected {
  background: rgba(168, 110, 29, 0.12);
  border-color: rgba(168, 110, 29, 0.58);
}

.choice--selected {
  box-shadow: inset 0 0 0 1px rgba(168, 110, 29, 0.45);
  font-weight: 900;
}

.choice:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.practice-end {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  margin-left: auto;
  padding: 8px 4px;
  text-decoration: underline;
}

.practice-end:hover {
  color: var(--text);
}

/* ---------- sticky バー ---------- */

.sticky-bar {
  align-items: center;
  background: var(--text);
  border-radius: 12px;
  bottom: 16px;
  box-shadow: 0 10px 30px rgba(58, 49, 34, 0.35);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  left: 50%;
  padding: 10px 12px 10px 18px;
  position: fixed;
  transform: translateX(-50%);
  width: min(calc(100% - 32px), 720px);
  z-index: 20;
}

.sticky-bar__summary {
  color: #f3e9d4;
  font-size: 0.92rem;
  font-weight: 700;
}

.sticky-bar .button--primary {
  background: #e8c36a;
  color: #1d1606;
}

.sticky-bar .button--primary:hover:not(:disabled) {
  background: #f3d38c;
}

/* ---------- フィードバック ---------- */

.feedback-panel {
  border-top: 1px solid var(--line);
  margin-top: 24px;
  padding-top: 22px;
}

.feedback-summary {
  align-items: center;
  border-radius: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  justify-content: space-between;
  padding: 14px 16px;
}

.feedback-summary--correct {
  background: rgba(37, 123, 85, 0.1);
  border: 1px solid rgba(37, 123, 85, 0.36);
}

.feedback-summary--incorrect {
  background: rgba(185, 74, 63, 0.1);
  border: 1px solid rgba(185, 74, 63, 0.36);
}

.partial-grid,
.breakdown-grid,
.stats-grid,
.reference-grid {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.partial-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.breakdown-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.stats-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.reference-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.result-badge {
  border-radius: 999px;
  font-weight: 900;
  padding: 9px 12px;
  text-align: center;
}

.is-correct {
  background: rgba(37, 123, 85, 0.1);
  border: 1px solid rgba(37, 123, 85, 0.34);
}

.is-incorrect {
  background: rgba(185, 74, 63, 0.1);
  border: 1px solid rgba(185, 74, 63, 0.34);
}

.breakdown-list {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
}

.breakdown-list dl,
.breakdown-list dd {
  margin: 0;
}

.breakdown-list div {
  align-items: start;
  border-top: 1px solid rgba(58, 49, 34, 0.1);
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 10px 0;
}

.breakdown-list div:first-of-type {
  border-top: 0;
}

.breakdown-list dt {
  color: var(--muted);
}

.breakdown-list dd {
  color: var(--text);
  font-weight: 900;
  text-align: right;
}

.breakdown-list small {
  color: var(--muted);
  display: block;
  font-weight: 500;
  max-width: 320px;
}

.explanation {
  color: var(--text);
  line-height: 1.8;
  margin: 18px 0 0;
}

.guide-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.guide-links a {
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--brass);
  padding: 7px 11px;
  text-decoration: none;
}

/* ---------- 結果 ---------- */

.score-hero {
  align-items: baseline;
  display: flex;
  gap: 12px;
}

.score-hero strong {
  color: var(--brass);
  font-size: clamp(2.6rem, 7vw, 4.4rem);
  letter-spacing: -0.05em;
}

.score-hero span,
.stat span {
  color: var(--muted);
}

.stat strong {
  color: var(--text);
  display: block;
  font-size: 1.5rem;
  margin-top: 8px;
}

/* ---------- ガイド ---------- */

.guide-section {
  margin-top: 16px;
  padding: clamp(20px, 3.5vw, 30px);
  scroll-margin-top: 88px;
}

.guide-section ol,
.guide-section ul {
  color: var(--muted);
  line-height: 1.9;
  padding-left: 1.3em;
}

.score-table-wrap {
  overflow-x: auto;
}

.score-table {
  border-collapse: collapse;
  min-width: 620px;
  width: 100%;
}

.score-table th,
.score-table td {
  border: 1px solid var(--line);
  padding: 12px;
  text-align: center;
}

.score-table th {
  background: rgba(168, 110, 29, 0.08);
  color: var(--text);
}

.score-table td {
  color: var(--muted);
}

/* ---------- レスポンシブ ---------- */

@media (max-width: 860px) {
  .site-header,
  .resume-card,
  .practice-card__topline {
    align-items: stretch;
    flex-direction: column;
  }

  .session-chip {
    margin-left: 0;
    text-align: center;
  }

  .practice-card__meta {
    justify-content: space-between;
  }

  .site-nav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  .site-nav a {
    text-align: center;
  }

  .feature-grid,
  .answer-grid,
  .partial-grid,
  .breakdown-grid,
  .stats-grid,
  .reference-grid {
    grid-template-columns: 1fr;
  }

  .choice-list--multi {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-actions .button,
  .resume-card__actions .button {
    flex: 1 1 100%;
  }

  .practice-actions .button {
    flex: 1 1 auto;
  }

  .sticky-bar {
    border-radius: 12px 12px 0 0;
    bottom: 0;
    width: 100%;
  }
}
```

- [ ] **Step 3: 確認**

Run: `npm run lint && npm test && npm run build`
Expected: 成功

`npm run dev` で目視確認: ホーム／練習（回答前・採点後・sticky バー）／ガイド／結果。モバイル幅（DevTools, 390px）でも sticky バーと回答欄が崩れないこと。

- [ ] **Step 4: コミット**

```bash
git add src/index.css src/App.css
git commit -m "style: flat warm visual refresh (radii, shadows, gradients removed)"
```

---

### Task 10: 最終検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全自動チェック**

Run: `npm run lint && npm test && npm run build`
Expected: すべて成功

- [ ] **Step 2: 出題バリエーションの実地確認**

`npm run dev` でミックスのまま15問ほど連続で解き、以下を確認:
- タイトルが「親／子の ロン／ツモ和了」のみで役名が出ない
- 同じ役構成が2問連続しない（バラエティガード）
- 50符以上の符ドリル・ドラ入り・副露手・三色/チャンタ系が混ざる
- 難易度セレクタ切替で出題帯が変わる

- [ ] **Step 3: 動線の実地確認**

- Enter で採点→次の問題が回る
- 採点後に解説へスクロールし、sticky バーから次へ進める
- ヘッダーのミニ成績が更新される
- 「終了して結果へ」リンク→結果画面→「新しいセッション」が回る

- [ ] **Step 4: 仕上げ**

問題なければ superpowers:finishing-a-development-branch スキルでブランチの統合方法を決める。



