# ランダム無限練習エンジン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 麻雀の点数計算問題を、難易度フィルタ付きでランダムに無限出題できるようにする。正解（役・翻・符・支払い）は外部OSS `@kobalab/majiang-core` の解析結果を唯一の正解源とする。

**Architecture:** ジェネレータが実戦的アーキタイプから合法な和了形を「提案」し、薄いアダプタ経由で majiang-core の `Util.hule` に通して採点。採点結果を `question-factory` が既存 `PracticeQuestion` 型（選択肢・誤答・解説付き）に変換し、UI は無限ストリームとして出題する。自前の点数/符/役ロジックは書かない。

**Tech Stack:** React 19 + Vite + TypeScript（ESM, strict）、vitest、`@kobalab/majiang-core`（MIT, 純JS, CommonJS）。

参照仕様: `docs/superpowers/specs/2026-06-08-random-practice-engine-design.md`

---

## ファイル構成

新規:
- `src/types/majiang-core.d.ts` — ライブラリの使用範囲の型宣言
- `src/domain/majiang-adapter.ts` — TileCode⇄majiang変換、`scoreHand` 採点ラッパ
- `src/domain/majiang-adapter.test.ts`
- `src/domain/yaku-map.ts` — majiang役名 ⇄ アプリ役キー/ラベル、役カタログ
- `src/domain/yaku-map.test.ts`
- `src/domain/golden.test.ts` — 既存8問でエンジン出力を検算・是正
- `src/domain/difficulty.ts` — ScoreResult → Difficulty 分類
- `src/domain/difficulty.test.ts`
- `src/domain/rng.ts` — seed可能PRNG
- `src/domain/distractors.ts` — 翻・支払いの誤答生成
- `src/domain/distractors.test.ts`
- `src/domain/generator.ts` — アーキタイプ生成＋整合性/リアリズム/難易度フィルタ
- `src/domain/generator.test.ts`
- `src/domain/question-factory.ts` — ScoreResult → PracticeQuestion
- `src/domain/question-factory.test.ts`

変更:
- `package.json` — 依存追加
- `src/domain/types.ts` — ScoreResult/ScoreInput/GeneratedHand/DifficultyFilter 追加、CompletedQuestion に fuRequired
- `src/domain/scoring.ts` — `calculateStats` を questions 引数なしに改修
- `src/domain/scoring.test.ts` — 上記に追随
- `src/domain/questions.ts` — `nextQuestionIndex` 削除（8問データは golden 用に温存）
- `src/App.tsx` — 無限ストリーム＋難易度フィルタ＋永続化v3＋Home文言

---

## Task 0: 依存追加とライブラリ疎通スパイク

**Files:**
- Modify: `package.json`
- Create: `src/types/majiang-core.d.ts`
- Create: `src/domain/majiang-adapter.test.ts`（スパイクのみ、後タスクで拡張）

- [ ] **Step 1: 依存を追加**

Run:
```bash
npm install @kobalab/majiang-core
```
Expected: `package.json` の dependencies に `@kobalab/majiang-core` が追加され、`npm install` がエラーなく完了。

- [ ] **Step 2: 型宣言を作成**

`src/types/majiang-core.d.ts`:
```ts
declare module '@kobalab/majiang-core' {
  export interface Shoupai {
    zimo(p: string, check?: boolean): Shoupai
    fulou(m: string, check?: boolean): Shoupai
    readonly menqian: boolean
    toString(): string
  }
  export interface ShoupaiStatic {
    fromString(paistr?: string): Shoupai
  }
  export interface HuleYaku {
    name: string
    fanshu: number | '*' | '**'
    baojia?: string
  }
  export interface HuleResult {
    hupai?: HuleYaku[] | null
    fu?: number
    fanshu?: number
    damanguan?: number | null
    defen: number
    fenpei: number[]
  }
  export interface HuleParam {
    rule?: Record<string, unknown>
    zhuangfeng?: number
    menfeng?: number
    lizhi?: number
    yifa?: boolean
    baopai?: string[]
    fubaopai?: string[] | null
    [key: string]: unknown
  }
  export interface MajiangUtil {
    hule(shoupai: Shoupai, rongpai: string | null, param: HuleParam): HuleResult
    xiangting(shoupai: Shoupai): number
  }
  interface MajiangModule {
    Shoupai: ShoupaiStatic
    Util: MajiangUtil
    rule(overrides?: Record<string, unknown>): Record<string, unknown>
  }
  const Majiang: MajiangModule
  export default Majiang
}
```

- [ ] **Step 3: 疎通スパイクテストを書く（失敗想定）**

`src/domain/majiang-adapter.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import Majiang from '@kobalab/majiang-core'

describe('majiang-core spike', () => {
  it('scores a known pinfu tsumo', () => {
    const { Shoupai, Util, rule } = Majiang
    const shoupai = Shoupai.fromString('z33m123p456s789m23').zimo('m4')
    const r = Util.hule(shoupai, null, { rule: rule(), zhuangfeng: 0, menfeng: 1 })
    expect(r.hupai?.map((y) => y.name)).toContain('平和')
    expect(r.hupai?.map((y) => y.name)).toContain('門前清自摸和')
    expect(r.fu).toBe(20)
    expect(r.fanshu).toBe(2)
  })
})
```

- [ ] **Step 4: 実行して挙動を確認**

Run: `npm run test -- majiang-adapter`
Expected: PASS。もし ESM/CJS の import で失敗する場合は `import Majiang from '@kobalab/majiang-core'` のままで Vitest が CJS 相互運用するはず。失敗時は `const Majiang = (await import('@kobalab/majiang-core')).default` 形を試す。**この PASS でライブラリの呼出規約が固定される。**

- [ ] **Step 5: コミット**

```bash
git add package.json package-lock.json src/types/majiang-core.d.ts src/domain/majiang-adapter.test.ts
git commit -m "chore: add @kobalab/majiang-core and verify scoring API"
```

---

## Task 1: 共有型の追加

**Files:**
- Modify: `src/domain/types.ts`

- [ ] **Step 1: 型を追加**

`src/domain/types.ts` の末尾に追記:
```ts
export type ScoreInput = {
  hand: TileCode[]          // 門前テンパイ牌（和了牌・副露牌を含まない）
  winningTile: TileCode
  melds: Meld[]
  context: WinContext
}

export type ScoreYaku = {
  name: string              // majiang の日本語役名
  han: number
  isDora: boolean           // ドラ/赤ドラ/裏ドラ（役選択肢から除外）
}

export type ScoreResult = {
  valid: boolean            // 和了かつ1役以上かつ役満でない
  yaku: ScoreYaku[]
  han: number
  fu: number | null         // 満貫以上で点数計算に不要な場合 null
  defen: number
  fenpei: number[]
  isLimit: boolean          // 満貫以上（fuRequired=false の根拠）
  dealer: boolean
  method: WinMethod
}

export type DifficultyFilter = Difficulty | 'mix'

export type GeneratedHand = ScoreInput & { seed: number }
```

- [ ] **Step 2: CompletedQuestion に fuRequired を追加**

`src/domain/types.ts` の `CompletedQuestion` を変更:
```ts
export type CompletedQuestion = {
  questionId: string
  fuRequired: boolean
  evaluation: AnswerEvaluation
  elapsedMs: number
  answeredAt: string
}
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: `scoring.ts`/`App.tsx`/`scoring.test.ts` が `fuRequired` 欠落でエラーになる（後続タスクで解消）。型定義自体の構文エラーがないことを確認。

- [ ] **Step 4: コミット**

```bash
git add src/domain/types.ts
git commit -m "feat: add scoring engine shared types"
```

---

## Task 2: 牌コードのマッピング

**Files:**
- Create: `src/domain/majiang-adapter.ts`
- Modify: `src/domain/majiang-adapter.test.ts`

- [ ] **Step 1: 往復テストを追加（失敗想定）**

`src/domain/majiang-adapter.test.ts` に追記:
```ts
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
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm run test -- majiang-adapter`
Expected: FAIL（関数未定義）。

- [ ] **Step 3: マッピングを実装**

`src/domain/majiang-adapter.ts`:
```ts
import type { TileCode } from './types'

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
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm run test -- majiang-adapter`
Expected: PASS（往復・bingpai テスト）。

- [ ] **Step 5: コミット**

```bash
git add src/domain/majiang-adapter.ts src/domain/majiang-adapter.test.ts
git commit -m "feat: add tile code <-> majiang mapping"
```

---

## Task 3: 採点アダプタ `scoreHand`（門前ロン/ツモ）

**Files:**
- Modify: `src/domain/majiang-adapter.ts`
- Modify: `src/domain/majiang-adapter.test.ts`

- [ ] **Step 1: 門前ロン/ツモのテストを追加（失敗想定）**

`src/domain/majiang-adapter.test.ts` に追記:
```ts
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
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm run test -- majiang-adapter`
Expected: FAIL（`scoreHand` 未定義）。

- [ ] **Step 3: `scoreHand` を実装**

`src/domain/majiang-adapter.ts` に追記:
```ts
import Majiang from '@kobalab/majiang-core'
import type { ScoreInput, ScoreResult, ScoreYaku, Wind } from './types'

const { Shoupai, Util, rule } = Majiang

const MLEAGUE_RULE = rule({
  '切り上げ満貫あり': true,
  '数え役満あり': false,
  '連風牌は2符': true,
})

const WIND_INDEX: Record<Wind, number> = { 東: 0, 南: 1, 西: 2, 北: 3 }

const DORA_NAMES = new Set(['ドラ', '赤ドラ', '裏ドラ'])

function meldToMajiang(meld: import('./types').Meld): string {
  const nums = meld.tiles.map((t) => Number(t[0]))
  const suit = meld.tiles[0][1]
  if (!meld.open) {
    // 暗槓のみ（v1 のジェネレータは暗槓を作らないが安全に対応）
    return suit + nums.join('')
  }
  if (meld.kind === 'chi') {
    const sorted = [...nums].sort((a, b) => a - b)
    // チーは上家(-)から最小牌を取った形にする（採点上は鳴き=明刻/順子の区別のみ重要）
    return `${suit}${sorted[0]}-${sorted[1]}${sorted[2]}`
  }
  // ポン / 明槓は末尾に下家(+)マーカー
  return `${suit}${nums.join('')}+`
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
    rongpai = `${toMajiang(winningTile)}+` // 方向は採点に影響しない
  }

  const r = Util.hule(shoupai, rongpai, {
    rule: MLEAGUE_RULE,
    zhuangfeng: WIND_INDEX[context.roundWind],
    menfeng: WIND_INDEX[context.seatWind],
    lizhi: context.riichi === 'ダブル立直' ? 2 : context.riichi ? 1 : 0,
    yifa: context.conditions.includes('一発'),
    baopai: context.doraIndicators.map(toMajiang),
  })

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
    valid: true,
    yaku,
    han,
    fu: r.fu ?? null,
    defen: r.defen,
    fenpei: r.fenpei,
    isLimit,
    dealer,
    method,
  }
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm run test -- majiang-adapter`
Expected: PASS。失敗する場合は majiang のロン牌表記（`m1+`）や `zimo` 規約を Task 0 スパイクの実挙動に合わせて調整。

- [ ] **Step 5: コミット**

```bash
git add src/domain/majiang-adapter.ts src/domain/majiang-adapter.test.ts
git commit -m "feat: add scoreHand adapter for menzen ron/tsumo"
```

---

## Task 4: 副露（鳴き）手の採点

**Files:**
- Modify: `src/domain/majiang-adapter.test.ts`

- [ ] **Step 1: 副露手のテストを追加**

`src/domain/majiang-adapter.test.ts` に追記:
```ts
describe('scoreHand (open hand)', () => {
  it('scores an open yakuhai (中) hand', () => {
    const input: ScoreInput = {
      hand: ['1m','1m','1m','2p','3p','4p','7s','8s','9s','5s'],
      winningTile: '5s',
      melds: [{ kind: 'pon', tiles: ['7z','7z','7z'], open: true, label: '中ポン' }],
      context: {
        seatWind: '東', roundWind: '東', dealer: true, method: 'ron',
        conditions: ['副露あり','ロン和了'], doraIndicators: ['8s'], ruleNotes: [],
      },
    }
    const r = scoreHand(input)
    expect(r.valid).toBe(true)
    expect(r.han).toBe(2) // 中1 + ドラ1
    expect(r.fu).toBe(40)
    expect(r.yaku.some((y) => !y.isDora && y.name.includes('中'))).toBe(true)
  })
})
```

- [ ] **Step 2: 実行**

Run: `npm run test -- majiang-adapter`
Expected: PASS（Task 3 の `meldToMajiang` で副露対応済み）。FAIL の場合は `meldToMajiang` のマーカー位置を majiang の実挙動に合わせて修正。

- [ ] **Step 3: コミット**

```bash
git add src/domain/majiang-adapter.test.ts
git commit -m "test: cover open-hand scoring via meld mapping"
```

---

## Task 5: 役名マッピングと役カタログ拡張

**Files:**
- Create: `src/domain/yaku-map.ts`
- Create: `src/domain/yaku-map.test.ts`

- [ ] **Step 1: テストを書く（失敗想定）**

`src/domain/yaku-map.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { mapYakuName, yakuCatalog } from './yaku-map'

describe('mapYakuName', () => {
  it('maps dragon and wind yakuhai', () => {
    expect(mapYakuName('立直')?.key).toBe('riichi')
    expect(mapYakuName('翻牌 白')?.key).toBe('yakuhai-haku')
    expect(mapYakuName('場風 東')?.key).toBe('yakuhai-bakaze')
    expect(mapYakuName('自風 南')?.key).toBe('yakuhai-jikaze')
  })

  it('returns null for dora (not a selectable yaku)', () => {
    expect(mapYakuName('ドラ')).toBeNull()
    expect(mapYakuName('赤ドラ')).toBeNull()
  })

  it('every mapped key exists in the catalog', () => {
    for (const name of ['立直','平和','断幺九','混全帯幺九','清一色','二盃口','一気通貫']) {
      const m = mapYakuName(name)
      expect(m, name).not.toBeNull()
      expect(yakuCatalog[m!.key], m!.key).toBeDefined()
    }
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm run test -- yaku-map`
Expected: FAIL（未定義）。

- [ ] **Step 3: 実装**

`src/domain/yaku-map.ts`:
```ts
import type { AnswerChoice } from './types'

// アプリで提示する役カタログ（仕様スコープの全役）。ドラは含めない。
export const yakuCatalog: Record<string, AnswerChoice> = {
  riichi: { key: 'riichi', label: '立直' },
  'double-riichi': { key: 'double-riichi', label: 'ダブル立直' },
  ippatsu: { key: 'ippatsu', label: '一発' },
  'menzen-tsumo': { key: 'menzen-tsumo', label: '門前清自摸和' },
  pinfu: { key: 'pinfu', label: '平和' },
  tanyao: { key: 'tanyao', label: '断幺九' },
  iipeiko: { key: 'iipeiko', label: '一盃口' },
  ryanpeiko: { key: 'ryanpeiko', label: '二盃口' },
  sanshoku: { key: 'sanshoku', label: '三色同順' },
  ittsu: { key: 'ittsu', label: '一気通貫' },
  chanta: { key: 'chanta', label: '混全帯幺九' },
  junchan: { key: 'junchan', label: '純全帯幺九' },
  honitsu: { key: 'honitsu', label: '混一色' },
  chinitsu: { key: 'chinitsu', label: '清一色' },
  toitoi: { key: 'toitoi', label: '対々和' },
  sananko: { key: 'sananko', label: '三暗刻' },
  honroutou: { key: 'honroutou', label: '混老頭' },
  chiitoitsu: { key: 'chiitoitsu', label: '七対子' },
  'yakuhai-haku': { key: 'yakuhai-haku', label: '白' },
  'yakuhai-hatsu': { key: 'yakuhai-hatsu', label: '發' },
  'yakuhai-chun': { key: 'yakuhai-chun', label: '中' },
  'yakuhai-bakaze': { key: 'yakuhai-bakaze', label: '場風牌' },
  'yakuhai-jikaze': { key: 'yakuhai-jikaze', label: '自風牌' },
}

// majiang の日本語役名 → カタログキー。完全一致と接頭辞一致を併用。
const EXACT: Record<string, string> = {
  立直: 'riichi',
  ダブル立直: 'double-riichi',
  '両立直': 'double-riichi',
  一発: 'ippatsu',
  門前清自摸和: 'menzen-tsumo',
  平和: 'pinfu',
  断幺九: 'tanyao',
  一盃口: 'iipeiko',
  二盃口: 'ryanpeiko',
  三色同順: 'sanshoku',
  一気通貫: 'ittsu',
  混全帯幺九: 'chanta',
  純全帯幺九: 'junchan',
  混一色: 'honitsu',
  清一色: 'chinitsu',
  対々和: 'toitoi',
  三暗刻: 'sananko',
  混老頭: 'honroutou',
  七対子: 'chiitoitsu',
}

const DRAGON: Record<string, string> = {
  白: 'yakuhai-haku',
  發: 'yakuhai-hatsu',
  中: 'yakuhai-chun',
}

export function mapYakuName(name: string): AnswerChoice | null {
  if (name === 'ドラ' || name === '赤ドラ' || name === '裏ドラ') return null
  if (EXACT[name]) return yakuCatalog[EXACT[name]]
  if (name.startsWith('場風')) return yakuCatalog['yakuhai-bakaze']
  if (name.startsWith('自風')) return yakuCatalog['yakuhai-jikaze']
  // 「翻牌 白」「役牌 白」等
  for (const [tile, key] of Object.entries(DRAGON)) {
    if (name.includes(tile)) return yakuCatalog[key]
  }
  return null
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm run test -- yaku-map`
Expected: PASS。majiang の実際の役名が EXACT/DRAGON と食い違う場合（例: 「役牌 白」「翻牌白」表記差）は、Task 6 ゴールデンで検出して本ファイルを修正。

- [ ] **Step 5: コミット**

```bash
git add src/domain/yaku-map.ts src/domain/yaku-map.test.ts
git commit -m "feat: add majiang yaku-name mapping and full yaku catalog"
```

---

## Task 6: ゴールデン検算（既存8問でエンジンを校正・是正）

**Files:**
- Create: `src/domain/golden.test.ts`

このタスクの目的は二つ: (a) アダプタ＋マッピング＋Mリーグ rule の正しさを既知手で確認、(b) 既存問題に潜む誤り（既知: Q1 切り上げ満貫、Q3 ドラ枚数）を engine 出力で是正・記録。**engine 出力が正解源。** 旧 canonical と食い違ったら旧問題が誤り。

- [ ] **Step 1: 校正テストを書く**

`src/domain/golden.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { practiceQuestions } from './questions'
import { scoreHand } from './majiang-adapter'
import { mapYakuName } from './yaku-map'

describe('golden: engine vs existing questions', () => {
  it('produces a valid, internally consistent score for every hand', () => {
    for (const q of practiceQuestions) {
      // 役満問題(国士)は出題スコープ外。スキップして個別 it で確認。
      if (q.difficulty === 'limit' && q.id.includes('kokushi')) continue
      const r = scoreHand({
        hand: q.hand, winningTile: q.winningTile, melds: q.melds, context: q.context,
      })
      expect(r.valid, q.id).toBe(true)
      // han は役(ドラ含む)の合計と一致
      expect(r.han, q.id).toBe(r.yaku.reduce((s, y) => s + y.han, 0))
      // すべての非ドラ役名がカタログにマップできる
      for (const y of r.yaku) {
        if (y.isDora) continue
        expect(mapYakuName(y.name), `${q.id}: ${y.name}`).not.toBeNull()
      }
    }
  })

  it('reconciles known discrepancies in the original fixtures', () => {
    // Q1: 30符4翻 子ロン。Mリーグ切り上げ満貫により 8000 / 満貫（旧データの7700は誤り）。
    const q1 = practiceQuestions.find((q) => q.id === 'q-pinfu-ron-30-4-child')!
    const r1 = scoreHand({ hand: q1.hand, winningTile: q1.winningTile, melds: q1.melds, context: q1.context })
    expect(r1.han).toBe(4)
    expect(r1.isLimit).toBe(true) // 切り上げ満貫 → 符不要
    expect(r1.defen).toBe(8000)

    // Q3: 三索が2枚=ドラ2。立直1+七対子2+ドラ2 = 5翻 満貫 8000（旧データの4翻6400は誤り）。
    const q3 = practiceQuestions.find((q) => q.id === 'q-chiitoi-ron-25-4-child')!
    const r3 = scoreHand({ hand: q3.hand, winningTile: q3.winningTile, melds: q3.melds, context: q3.context })
    expect(r3.han).toBe(5)
    expect(r3.isLimit).toBe(true)
    expect(r3.defen).toBe(8000)
  })
})
```

- [ ] **Step 2: 実行し、エンジンの実出力で期待値を確定**

Run: `npm run test -- golden`
Expected: 第1テストは PASS が目標。第2テストの厳密値（`defen`/`han`）は majiang の実挙動で確認し、**手計算（独立検証ワークフロー）で正しさを確認した上で**期待値を確定。Q1/Q3 以外で旧 canonical と食い違う問題が出たら、同様に手計算で是正値を記録し本テストに追記する（旧問題が誤り）。役名マップの欠落が出たら Task 5 を修正。

- [ ] **Step 3: 是正の記録**

`docs/superpowers/specs/2026-06-08-random-practice-engine-design.md` の末尾に「## 16. 既存問題の是正記録」を追記し、検出した誤り（Q1, Q3, ほか）と是正値・根拠を箇条書きで残す。

- [ ] **Step 4: コミット**

```bash
git add src/domain/golden.test.ts docs/superpowers/specs/2026-06-08-random-practice-engine-design.md
git commit -m "test: golden reconciliation of engine vs existing fixtures"
```

---

## Task 7: 難易度分類

**Files:**
- Create: `src/domain/difficulty.ts`
- Create: `src/domain/difficulty.test.ts`

- [ ] **Step 1: テストを書く（失敗想定）**

`src/domain/difficulty.test.ts`:
```ts
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
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm run test -- difficulty`
Expected: FAIL（未定義）。

- [ ] **Step 3: 実装**

`src/domain/difficulty.ts`:
```ts
import type { Difficulty, ScoreInput, ScoreResult } from './types'

const ADVANCED_YAKU = new Set([
  '混一色', '清一色', '三色同順', '一気通貫', '混全帯幺九', '純全帯幺九',
  '対々和', '三暗刻', '二盃口', '混老頭',
])
const STARTER_YAKU = new Set([
  '立直', '一発', '門前清自摸和', '平和', '断幺九', '一盃口',
])

function isOpen(input: ScoreInput): boolean {
  return input.melds.some((m) => m.open)
}

export function classifyDifficulty(result: ScoreResult, input: ScoreInput): Difficulty {
  if (result.isLimit) return 'limit'

  const named = result.yaku.filter((y) => !y.isDora).map((y) => y.name)
  const hasAdvanced =
    isOpen(input) ||
    named.some((n) => ADVANCED_YAKU.has(n) || n.startsWith('場風') || n.startsWith('自風')) ||
    (result.fu ?? 0) >= 50
  if (hasAdvanced) return 'advanced'

  const allStarter =
    named.length > 0 &&
    named.every((n) => STARTER_YAKU.has(n) || n.includes('白') || n.includes('發') || n.includes('中'))
  if (result.han <= 2 && allStarter && (result.fu ?? 0) <= 40) return 'starter'

  return 'standard'
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm run test -- difficulty`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/domain/difficulty.ts src/domain/difficulty.test.ts
git commit -m "feat: add difficulty classifier"
```

---

## Task 8: seed可能 RNG

**Files:**
- Create: `src/domain/rng.ts`
- Create: `src/domain/rng.test.ts`

- [ ] **Step 1: テストを書く（失敗想定）**

`src/domain/rng.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = [a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })

  it('int(n) returns values in [0, n)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 100; i++) {
      const v = rng.int(5)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(5)
    }
  })

  it('pick returns an element of the array', () => {
    const rng = createRng(1)
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 20; i++) expect(arr).toContain(rng.pick(arr))
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm run test -- rng`
Expected: FAIL（未定義）。

- [ ] **Step 3: 実装（mulberry32）**

`src/domain/rng.ts`:
```ts
export type Rng = {
  seed: number
  next(): number          // [0,1)
  int(n: number): number  // [0,n)
  pick<T>(items: readonly T[]): T
  bool(p?: number): boolean
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    seed,
    next,
    int: (n) => Math.floor(next() * n),
    pick: (items) => items[Math.floor(next() * items.length)],
    bool: (p = 0.5) => next() < p,
  }
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm run test -- rng`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/domain/rng.ts src/domain/rng.test.ts
git commit -m "feat: add seedable PRNG"
```

---

## Task 9: ジェネレータ（アーキタイプ＋整合性/リアリズム/難易度）

**Files:**
- Create: `src/domain/generator.ts`
- Create: `src/domain/generator.test.ts`

設計: 各アーキタイプは `(rng) => ScoreInput` を返す純関数。`generate(filter, rng)` がアーキタイプを選び、`scoreHand` で採点し、整合性インバリアント・リアリズム・難易度を満たすまで棄却再生成する。**整合性はアーキタイプ構成段階で保証**（門前アーキタイプは副露を作らない・立直を門前のみに付与等）。

- [ ] **Step 1: プロパティテストを書く（失敗想定）**

`src/domain/generator.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { generate } from './generator'
import { scoreHand } from './majiang-adapter'
import { classifyDifficulty } from './difficulty'
import { createRng } from './rng'
import type { TileCode } from './types'

function tileCounts(tiles: TileCode[]): Map<string, number> {
  const norm = (t: TileCode) => (t[0] === '0' ? `5${t[1]}` : t)
  const m = new Map<string, number>()
  for (const t of tiles) m.set(norm(t), (m.get(norm(t)) ?? 0) + 1)
  return m
}

describe('generate (property tests)', () => {
  it('always yields a valid, consistent, 14-tile hand', () => {
    const rng = createRng(12345)
    for (let i = 0; i < 200; i++) {
      const { input, result } = generate('mix', rng)
      const all = [
        ...input.hand, input.winningTile, ...input.melds.flatMap((m) => m.tiles),
      ]
      expect(all.length, `iter ${i}`).toBe(14)
      for (const [t, c] of tileCounts(all)) expect(c, `${i}:${t}`).toBeLessThanOrEqual(4)
      expect(result.valid, `iter ${i}`).toBe(true)

      // 整合性: 立直系/門前ツモは門前限定。一発は立直時のみ。
      const open = input.melds.some((m) => m.open)
      const names = result.yaku.map((y) => y.name)
      if (open) {
        expect(names).not.toContain('立直')
        expect(names).not.toContain('門前清自摸和')
        expect(names).not.toContain('一発')
      }
      if (names.includes('一発')) expect(names.some((n) => n.includes('立直'))).toBe(true)

      // 採点の再現性（同じ入力 → 同じ結果）
      const again = scoreHand(input)
      expect(again.defen, `iter ${i}`).toBe(result.defen)
    }
  })

  it('respects the requested difficulty filter', () => {
    const rng = createRng(999)
    for (const filter of ['starter', 'standard', 'advanced', 'limit'] as const) {
      for (let i = 0; i < 30; i++) {
        const { input, result } = generate(filter, rng)
        expect(classifyDifficulty(result, input), `${filter}:${i}`).toBe(filter)
      }
    }
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm run test -- generator`
Expected: FAIL（未定義）。

- [ ] **Step 3: アーキタイプ基盤と初期セットを実装**

`src/domain/generator.ts`:
```ts
import type {
  Difficulty, DifficultyFilter, Meld, ScoreInput, ScoreResult, TileCode, Wind,
} from './types'
import { scoreHand } from './majiang-adapter'
import { classifyDifficulty } from './difficulty'
import type { Rng } from './rng'

const WINDS: Wind[] = ['東', '南', '西', '北']
const SUITS = ['m', 'p', 's'] as const

type Built = ScoreInput

function ctx(
  rng: Rng,
  over: Partial<ScoreInput['context']> & { method: 'ron' | 'tsumo' },
): ScoreInput['context'] {
  const dealer = over.dealer ?? rng.bool(0.5)
  const roundWind = over.roundWind ?? '東'
  const seatWind = over.seatWind ?? (dealer ? '東' : rng.pick(['南', '西', '北']))
  return {
    seatWind, roundWind, dealer, method: over.method,
    riichi: over.riichi, conditions: over.conditions ?? [],
    doraIndicators: over.doraIndicators ?? [],
    ruleNotes: ['Mリーグ準拠', '0本場・供託なし'],
  }
}

// 数牌の順子3枚（連続）。t..t+2
function run(suit: (typeof SUITS)[number], t: number): TileCode[] {
  return [`${t}${suit}`, `${t + 1}${suit}`, `${t + 2}${suit}`] as TileCode[]
}
function trip(tile: TileCode): TileCode[] {
  return [tile, tile, tile]
}

// ドラ表示牌を「指定枚数だけ手にドラが乗る」よう選ぶのは複雑なので、
// v1 は手に絡みにくい字牌等を表示牌に使い、ドラ0〜1で安定させる。
function doraIndicator(rng: Rng, avoid: Set<string>): TileCode {
  const candidates: TileCode[] = (['1z','2z','3z','4z','5z','6z','7z'] as TileCode[])
    .filter((t) => !avoid.has(t))
  return rng.pick(candidates.length ? candidates : (['1z'] as TileCode[]))
}

// --- アーキタイプ ---
// 各 archetype は完成14牌相当を作り、和了牌1枚を hand から抜いて winningTile にする。

type Archetype = { name: string; bias: Difficulty; build: (rng: Rng) => Built }

function tanyaoRon(rng: Rng): Built {
  // 断幺九・門前・両面待ち（2-8の順子中心）
  const s = rng.pick(SUITS)
  const tiles: TileCode[] = [
    ...run(s, 2), ...run(s, 6),
    ...run(rng.pick(SUITS), 3),
    ...trip(`${rng.pick([2,3,4,5,6,7,8])}${rng.pick(SUITS)}` as TileCode).slice(0, 2), // 雀頭
  ] as TileCode[]
  // 14枚に満たない分を別順子で補完
  while (tiles.length < 14) tiles.push(...run(rng.pick(SUITS), rng.pick([2,3,4,5,6])) )
  const hand14 = tiles.slice(0, 14)
  const winningTile = hand14[0]
  const hand = hand14.slice(1)
  return { hand, winningTile, melds: [], context: ctx(rng, { method: 'ron', conditions: ['門前','ロン和了'], doraIndicators: [doraIndicator(rng, new Set(hand14))] }) }
}

function pinfuTsumo(rng: Rng): Built {
  // 平和ツモ・門前・両面・雀頭は数牌の非役牌
  const head = `${rng.pick([2,3,4,5,6,7,8])}${rng.pick(SUITS)}` as TileCode
  const tiles: TileCode[] = [
    ...run(SUITS[0], 1), ...run(SUITS[0], 5),
    ...run(SUITS[1], 2), ...run(SUITS[2], 6),
    head, head,
  ] as TileCode[]
  const hand14 = tiles.slice(0, 14)
  const winningTile = hand14[0]
  const hand = hand14.slice(1)
  const riichi = rng.bool(0.6) ? '立直' as const : undefined
  return {
    hand, winningTile, melds: [],
    context: ctx(rng, {
      method: 'tsumo', riichi,
      conditions: ['門前','ツモ和了', ...(riichi && rng.bool(0.3) ? ['一発'] : [])],
      doraIndicators: [doraIndicator(rng, new Set(hand14))],
    }),
  }
}

function yakuhaiPon(rng: Rng): Built {
  // 役牌(白/發/中)ポンの副露手
  const dragon = rng.pick(['5z','6z','7z'] as TileCode[])
  const s = rng.pick(SUITS)
  const head = `${rng.pick([1,9])}${rng.pick(SUITS)}` as TileCode
  const hand: TileCode[] = [...run(s, 2), ...run(s, 6), ...trip(`5${rng.pick(SUITS)}` as TileCode).slice(0,1), head, head] as TileCode[]
  // 副露(ポン)で3枚、手は10枚 + 和了牌
  const concealed = [...run(s, 2), ...run(s, 6), head, head] as TileCode[] // 8枚 → 和了牌で9枚目? 調整
  const winningTile = run(s, 2)[0]
  return {
    hand: concealed.slice(1), winningTile,
    melds: [{ kind: 'pon', tiles: trip(dragon), open: true, label: `${dragon}ポン` }],
    context: ctx(rng, { method: 'ron', conditions: ['副露あり','ロン和了'], doraIndicators: [doraIndicator(rng, new Set([...concealed, dragon]))] }),
  }
}

function chiitoitsu(rng: Rng): Built {
  // 七対子・門前
  const pairs: TileCode[] = []
  const used = new Set<string>()
  while (pairs.length < 14) {
    const suit = rng.pick([...SUITS, 'z'] as const)
    const max = suit === 'z' ? 7 : 9
    const n = 1 + rng.int(max)
    const key = `${n}${suit}`
    if (used.has(key)) continue
    used.add(key)
    pairs.push(key as TileCode, key as TileCode)
  }
  const winningTile = pairs[0]
  const hand = pairs.slice(1)
  const riichi = rng.bool(0.6) ? '立直' as const : undefined
  return {
    hand, winningTile, melds: [],
    context: ctx(rng, { method: 'ron', riichi, conditions: ['門前','ロン和了'], doraIndicators: [doraIndicator(rng, used)] }),
  }
}

const ARCHETYPES: Archetype[] = [
  { name: 'tanyao-ron', bias: 'starter', build: tanyaoRon },
  { name: 'pinfu-tsumo', bias: 'starter', build: pinfuTsumo },
  { name: 'yakuhai-pon', bias: 'advanced', build: yakuhaiPon },
  { name: 'chiitoitsu', bias: 'standard', build: chiitoitsu },
]

function realistic(result: ScoreResult, filter: DifficultyFilter): boolean {
  const doraHan = result.yaku.filter((y) => y.isDora).reduce((s, y) => s + y.han, 0)
  if (doraHan > 3) return false // ドラ過多を抑制
  if (filter === 'starter' && result.han > 3) return false
  return true
}

export function generate(
  filter: DifficultyFilter,
  rng: Rng,
): { input: ScoreInput; result: ScoreResult } {
  for (let attempt = 0; attempt < 200; attempt++) {
    const arch = rng.pick(ARCHETYPES)
    let input: ScoreInput
    try {
      input = arch.build(rng)
    } catch {
      continue
    }
    const all = [...input.hand, input.winningTile, ...input.melds.flatMap((m) => m.tiles)]
    if (all.length !== 14) continue
    const result = scoreHand(input)
    if (!result.valid) continue
    if (!realistic(result, filter)) continue
    const diff = classifyDifficulty(result, input)
    if (filter !== 'mix' && diff !== filter) continue
    return { input: { ...input }, result }
  }
  // フォールバック: 難易度・リアリズム不問で valid な手を返す
  for (let attempt = 0; attempt < 200; attempt++) {
    const input = rng.pick(ARCHETYPES).build(rng)
    const all = [...input.hand, input.winningTile, ...input.melds.flatMap((m) => m.tiles)]
    if (all.length !== 14) continue
    const result = scoreHand(input)
    if (result.valid) return { input, result }
  }
  throw new Error('generator: failed to produce a valid hand')
}
```

> 注: 上記アーキタイプの牌構成は「14枚・各≤4・有役」を満たすよう TDD で詰める。Step 4 のプロパティテストが落ちる箇所（枚数ズレ・無役・難易度不一致）を、各 `build` 関数を直して緑にする。`yakuhaiPon` 等の枚数調整は失敗テストを見ながら確定すること。

- [ ] **Step 4: テストを回して各アーキタイプを修正**

Run: `npm run test -- generator`
Expected: 反復修正の末 PASS。各 `build` が 14枚・各≤4・`result.valid`・要求難易度を満たすまで調整。整合性（副露時に立直等が付かない）は構成で保証されているか確認。

- [ ] **Step 5: アーキタイプを追加（変化量確保）**

同じ `Archetype` インタフェースで以下を追加実装し、`ARCHETYPES` に登録する（各々 TDD で枚数・有役・難易度を満たすまで調整）:
- `honitsuOpen`（混一色・副露, bias 'advanced'）: 1色の数牌＋字牌で構成、役牌or混一。
- `sanshokuRon`（三色同順・門前, bias 'standard'）: 3色同じ並びの順子＋雀頭。
- `ittsuMenzen`（一気通貫・門前, bias 'advanced'）: 同色123/456/789＋1面子＋雀頭。
- `toitoiPon`（対々和・副露, bias 'advanced'）: 刻子4＋雀頭、ポン1〜2。

Run: `npm run test -- generator`
Expected: PASS（追加後も全プロパティ緑）。

- [ ] **Step 6: コミット**

```bash
git add src/domain/generator.ts src/domain/generator.test.ts
git commit -m "feat: add archetype-based hand generator with invariants and realism filter"
```

---

## Task 10: 誤答（distractors）生成

**Files:**
- Create: `src/domain/distractors.ts`
- Create: `src/domain/distractors.test.ts`

- [ ] **Step 1: テストを書く（失敗想定）**

`src/domain/distractors.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { hanChoices, paymentChoice, paymentDistractors } from './distractors'
import { createRng } from './rng'
import type { ScoreResult } from './types'

const base: ScoreResult = {
  valid: true, yaku: [], han: 3, fu: 30, defen: 3900,
  fenpei: [-3900, 3900, 0, 0], isLimit: false, dealer: false, method: 'ron',
}

describe('distractors', () => {
  it('han choices include the correct han and total 4 unique options', () => {
    const choices = hanChoices(base, createRng(1))
    expect(choices).toHaveLength(4)
    expect(choices.map((c) => c.key)).toContain('3')
    expect(new Set(choices.map((c) => c.key)).size).toBe(4)
  })

  it('payment choices include the correct payment and 3 distinct distractors', () => {
    const correct = paymentChoice(base)
    const all = paymentDistractors(base, createRng(2))
    expect(all.map((c) => c.key)).toContain(correct.key)
    expect(all).toHaveLength(4)
    expect(new Set(all.map((c) => c.key)).size).toBe(4)
  })

  it('formats a child tsumo as "ko / oya"', () => {
    const tsumo: ScoreResult = { ...base, method: 'tsumo', defen: 5200, fenpei: [-2600, 5200, -1300, -1300] }
    expect(paymentChoice(tsumo).label).toBe('1300 / 2600点')
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm run test -- distractors`
Expected: FAIL（未定義）。

- [ ] **Step 3: 実装**

`src/domain/distractors.ts`:
```ts
import type { AnswerChoice, ScoreResult } from './types'
import type { Rng } from './rng'

export function paymentChoice(result: ScoreResult): AnswerChoice {
  const label = formatPayment(result)
  return { key: paymentKey(result), label }
}

function paymentKey(result: ScoreResult): string {
  return `pay-${result.method}-${result.dealer ? 'oya' : 'ko'}-${result.defen}`
}

export function formatPayment(result: ScoreResult): string {
  if (result.method === 'ron') return `${result.defen}点`
  // tsumo: fenpei から支払い額を読む（勝者以外の絶対値）
  const pays = result.fenpei.filter((v) => v < 0).map((v) => Math.abs(v))
  if (result.dealer) {
    return `${pays[0]}点オール`
  }
  const ko = Math.min(...pays)
  const oya = Math.max(...pays)
  return `${ko} / ${oya}点`
}

export function hanChoices(result: ScoreResult, rng: Rng): AnswerChoice[] {
  const correct = result.han
  const candidates = new Set<number>([correct])
  for (const d of [-1, 1, 2, -2, 3]) {
    const v = correct + d
    if (v >= 1 && v <= 13) candidates.add(v)
    if (candidates.size >= 4) break
  }
  const arr = [...candidates].slice(0, 4).sort((a, b) => a - b)
  return arr.map((v) => ({ key: String(v), label: `${v}翻` }))
}

export function paymentDistractors(result: ScoreResult, rng: Rng): AnswerChoice[] {
  const correct = paymentChoice(result)
  const out: AnswerChoice[] = [correct]
  const factors = [0.5, 1.5, 2, 0.75]
  for (const f of factors) {
    const alt: ScoreResult = { ...result, defen: roundTo100(result.defen * f), fenpei: result.fenpei.map((v) => roundTo100(v * f)) }
    const c = paymentChoice(alt)
    if (!out.some((o) => o.key === c.key)) out.push(c)
    if (out.length >= 4) break
  }
  // 足りなければ加点でユニーク化
  let bump = 1
  while (out.length < 4) {
    const alt: ScoreResult = { ...result, defen: result.defen + 100 * bump, fenpei: result.fenpei }
    const c = { key: `pay-extra-${bump}`, label: `${alt.defen}点` }
    if (!out.some((o) => o.key === c.key)) out.push(c)
    bump++
  }
  return shuffle(out, rng)
}

function roundTo100(n: number): number {
  return Math.round(n / 100) * 100
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm run test -- distractors`
Expected: PASS。`formatPayment` の tsumo 表記が既存スタイルと一致するか確認。

- [ ] **Step 5: コミット**

```bash
git add src/domain/distractors.ts src/domain/distractors.test.ts
git commit -m "feat: add han/payment distractor generation"
```

---

## Task 11: 出題ファクトリ

**Files:**
- Create: `src/domain/question-factory.ts`
- Create: `src/domain/question-factory.test.ts`

- [ ] **Step 1: テストを書く（失敗想定）**

`src/domain/question-factory.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildQuestion } from './question-factory'
import { evaluateAnswer } from './scoring'
import { generate } from './generator'
import { createRng } from './rng'

describe('buildQuestion', () => {
  it('produces a question whose canonical answer is selectable and complete-correct', () => {
    const rng = createRng(2024)
    for (let i = 0; i < 100; i++) {
      const { input, result } = generate('mix', rng)
      const q = buildQuestion(input, result, rng)

      // 正解役がすべて選択肢にある
      const yakuKeys = q.options.yaku.map((c) => c.key)
      for (const k of q.canonicalInterpretation.yakuKeys) expect(yakuKeys, q.id).toContain(k)
      // 翻/符/支払いの正解が選択肢にある
      expect(q.options.han.map((c) => c.key), q.id).toContain(q.canonicalInterpretation.hanKey)
      expect(q.options.payment.map((c) => c.key), q.id).toContain(q.canonicalInterpretation.paymentKey)

      // canonical を入れて評価すると完全正解
      const evalResult = evaluateAnswer(q, {
        yakuKeys: q.canonicalInterpretation.yakuKeys,
        hanKey: q.canonicalInterpretation.hanKey,
        fuKey: q.canonicalInterpretation.fuKey,
        paymentKey: q.canonicalInterpretation.paymentKey,
      })
      expect(evalResult.completeCorrect, q.id).toBe(true)
    }
  })
})
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm run test -- question-factory`
Expected: FAIL（未定義）。

- [ ] **Step 3: 実装**

`src/domain/question-factory.ts`:
```ts
import type {
  AcceptedInterpretation, AnswerChoice, BreakdownItem,
  PracticeQuestion, ScoreInput, ScoreResult,
} from './types'
import { mapYakuName, yakuCatalog } from './yaku-map'
import { hanChoices, paymentChoice, paymentDistractors } from './distractors'
import { classifyDifficulty } from './difficulty'
import type { Rng } from './rng'

const FU_CHOICES: AnswerChoice[] = [
  { key: '20', label: '20符' }, { key: '25', label: '25符' },
  { key: '30', label: '30符' }, { key: '40', label: '40符' },
  { key: '50', label: '50符' }, { key: '60', label: '60符' },
  { key: '70', label: '70符' },
  { key: 'not-needed', label: '符は不要', helper: '満貫以上または役満' },
]

// 混同しやすい役（誤答候補プール）
const CONFUSABLE: Record<string, string[]> = {
  pinfu: ['tanyao', 'iipeiko', 'sanshoku'],
  tanyao: ['pinfu', 'sanshoku', 'iipeiko'],
  honitsu: ['chinitsu', 'chanta', 'junchan'],
  chinitsu: ['honitsu', 'ittsu'],
  toitoi: ['sananko', 'honroutou'],
  sananko: ['toitoi'],
  chiitoitsu: ['toitoi', 'iipeiko', 'ryanpeiko'],
  iipeiko: ['ryanpeiko', 'pinfu', 'sanshoku'],
}

function correctYakuKeys(result: ScoreResult): string[] {
  const keys: string[] = []
  for (const y of result.yaku) {
    if (y.isDora) continue
    const mapped = mapYakuName(y.name)
    if (mapped && !keys.includes(mapped.key)) keys.push(mapped.key)
  }
  return keys
}

function yakuOptions(correct: string[], rng: Rng): AnswerChoice[] {
  const set = new Set(correct)
  for (const k of correct) for (const c of CONFUSABLE[k] ?? []) set.add(c)
  // 6個以上になるよう一般役で補充
  const filler = ['riichi', 'menzen-tsumo', 'pinfu', 'tanyao', 'sanshoku', 'honitsu', 'toitoi']
  for (const k of filler) { if (set.size >= 7) break; set.add(k) }
  const choices = [...set].map((k) => yakuCatalog[k]).filter(Boolean)
  // シャッフル
  for (let i = choices.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[choices[i], choices[j]] = [choices[j], choices[i]]
  }
  return choices
}

function doraNote(input: ScoreInput): string {
  const ind = input.context.doraIndicators[0]
  return ind ? `ドラ表示牌は ${ind}。` : ''
}

export function buildQuestion(
  input: ScoreInput, result: ScoreResult, rng: Rng,
): PracticeQuestion {
  const difficulty = classifyDifficulty(result, input)
  const fuRequired = !result.isLimit
  const yakuKeys = correctYakuKeys(result)
  const payment = paymentChoice(result)
  const hanKey = String(result.han)
  const fuKey = fuRequired ? String(result.fu) : 'not-needed'

  const canonical: AcceptedInterpretation = {
    yakuKeys,
    hanKey,
    hanLabel: `${result.han}翻`,
    fuKey,
    fuLabel: fuRequired ? `${result.fu}符` : '点数計算上は不要',
    paymentKey: payment.key,
    paymentLabel: payment.label,
  }

  const yakuBreakdown: BreakdownItem[] = result.yaku.map((y) => ({
    label: y.isDora ? y.name : (mapYakuName(y.name)?.label ?? y.name),
    value: `${y.han}翻`,
  }))
  const fuBreakdown: BreakdownItem[] = fuRequired
    ? [{ label: '合計符', value: `${result.fu}符` }]
    : [{ label: '満貫以上', value: '符計算は不要' }]

  const seed = rng.seed
  const yakuText = yakuKeys.map((k) => yakuCatalog[k].label).join('・') || '役'
  return {
    id: `gen-${difficulty}-${seed}-${result.han}-${result.fu ?? 'L'}-${result.defen}`,
    title: yakuKeys.length ? `${yakuCatalog[yakuKeys[0]].label}を含む手` : '点数を計算',
    difficulty,
    prompt: `${input.context.dealer ? '親' : '子'}の${input.context.method === 'ron' ? 'ロン' : 'ツモ'}和了。成立役・翻・符・支払いを選んでください。`,
    context: input.context,
    hand: input.hand,
    winningTile: input.winningTile,
    melds: input.melds,
    options: {
      yaku: yakuOptions(yakuKeys, rng),
      han: hanChoices(result, rng),
      fu: FU_CHOICES,
      payment: paymentDistractors(result, rng),
    },
    acceptedInterpretations: [canonical],
    canonicalInterpretation: canonical,
    fuRequired,
    yaku: yakuBreakdown,
    fu: fuBreakdown,
    explanation:
      `成立役は ${yakuText}。${doraNote(input)}` +
      (fuRequired
        ? `${result.han}翻${result.fu}符で${payment.label}です。`
        : `${result.han}翻以上の満貫クラスで${payment.label}です。`),
    guideAnchors: fuRequired ? ['fu', 'table'] : ['limit', 'payment'],
  }
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm run test -- question-factory`
Expected: PASS。`evaluateAnswer` の符判定（`fuRequired` 時の `fuKey` 一致）に注意。落ちる場合は canonical の `fuKey`/`paymentKey` と options の key 整合を確認。

- [ ] **Step 5: コミット**

```bash
git add src/domain/question-factory.ts src/domain/question-factory.test.ts
git commit -m "feat: build PracticeQuestion from engine score result"
```

---

## Task 12: scoring.ts の改修（questions 依存を除去）

**Files:**
- Modify: `src/domain/scoring.ts:48-103`
- Modify: `src/domain/scoring.test.ts`

- [ ] **Step 1: 既存テストを新シグネチャへ更新**

`src/domain/scoring.test.ts` の `calculateStats` テスト（130-169行付近）を、`completed` 各要素に `fuRequired` を持たせ、`calculateStats(completed)` を引数1つで呼ぶよう修正:
```ts
const completed = [
  {
    questionId: regular.id,
    fuRequired: true,
    evaluation: evaluateAnswer(regular, { /* canonical 略・既存どおり */
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
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm run test -- scoring`
Expected: FAIL（`calculateStats` がまだ2引数）。

- [ ] **Step 3: `calculateStats` を改修**

`src/domain/scoring.ts` の `calculateStats` を変更:
```ts
export function calculateStats(completed: CompletedQuestion[]): SessionStats {
  if (completed.length === 0) {
    return {
      total: 0, completeCorrect: 0, completeRate: 0, yakuRate: 0, hanRate: 0,
      fuRate: null, paymentRate: 0, bestStreak: 0, currentStreak: 0, averageSeconds: 0,
    }
  }

  const completeCorrect = completed.filter((e) => e.evaluation.completeCorrect).length
  const hanCorrect = completed.filter((e) => e.evaluation.hanCorrect).length
  const yakuCorrect = completed.filter((e) => e.evaluation.yakuCorrect).length
  const paymentCorrect = completed.filter((e) => e.evaluation.paymentCorrect).length
  const fuEntries = completed.filter((e) => e.fuRequired)
  const fuCorrect = fuEntries.filter((e) => e.evaluation.fuCorrect).length
  const streaks = completed.reduce(
    (state, entry) => {
      const current = entry.evaluation.completeCorrect ? state.current + 1 : 0
      return { current, best: Math.max(state.best, current) }
    },
    { current: 0, best: 0 },
  )
  const averageMs = completed.reduce((sum, e) => sum + e.elapsedMs, 0) / completed.length

  return {
    total: completed.length,
    completeCorrect,
    completeRate: ratio(completeCorrect, completed.length),
    yakuRate: ratio(yakuCorrect, completed.length),
    hanRate: ratio(hanCorrect, completed.length),
    fuRate: fuEntries.length > 0 ? ratio(fuCorrect, fuEntries.length) : null,
    paymentRate: ratio(paymentCorrect, completed.length),
    bestStreak: streaks.best,
    currentStreak: streaks.current,
    averageSeconds: Math.round((averageMs / 1000) * 10) / 10,
  }
}
```
また `import type { PracticeQuestion }` が未使用になったら削除する。

- [ ] **Step 4: 実行して成功を確認**

Run: `npm run test -- scoring`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/domain/scoring.ts src/domain/scoring.test.ts
git commit -m "refactor: make calculateStats independent of the question array"
```

---

## Task 13: App 統合（無限ストリーム＋難易度フィルタ＋永続化v3）

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/domain/questions.ts`（`nextQuestionIndex` 削除）
- Modify: `src/App.css`（難易度チップのスタイル追記）

- [ ] **Step 1: `nextQuestionIndex` を削除**

`src/domain/questions.ts` 末尾の `nextQuestionIndex` 関数（557-560行付近）を削除。`practiceQuestions` と `getQuestionById` は残す。

- [ ] **Step 2: App をジェネレータ駆動へ書き換え**

`src/App.tsx` の上部 import と App 本体を変更。

import 差し替え:
```ts
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { DoraView, HandView } from './components/TileView'
import { calculateStats, evaluateAnswer, formatRate } from './domain/scoring'
import { generate } from './domain/generator'
import { buildQuestion } from './domain/question-factory'
import { createRng } from './domain/rng'
import { difficultyLabel } from './domain/difficulty-label'
import type {
  AnswerChoice, AnswerEvaluation, CompletedQuestion, DifficultyFilter,
  PracticeQuestion, SessionStats, UserAnswer,
} from './domain/types'
```

State / 永続化 / 生成ロジックを差し替え:
```ts
const storageKey = 'mahjong-score-trainer-session-v3'

type StoredSession = {
  difficulty: DifficultyFilter
  completed: CompletedQuestion[]
}

const emptyAnswer: UserAnswer = { yakuKeys: [], hanKey: null, fuKey: null, paymentKey: null }

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

function makeQuestion(difficulty: DifficultyFilter): PracticeQuestion {
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
  const rng = createRng(seed)
  const { input, result } = generate(difficulty, rng)
  return buildQuestion({ ...input }, result, rng)
}

function App() {
  const [session, setSession] = useState<StoredSession>(() => loadSession())
  const [question, setQuestion] = useState<PracticeQuestion>(() => makeQuestion(loadSession().difficulty))

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
```

Routes の `/practice` を差し替え:
```tsx
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
```

- [ ] **Step 3: PracticePage に難易度チップを追加**

`PracticePageProps` と本体を変更:
```tsx
type PracticePageProps = {
  question: PracticeQuestion
  completedCount: number
  difficulty: DifficultyFilter
  onSetDifficulty: (d: DifficultyFilter) => void
  onAnswered: (evaluation: AnswerEvaluation, elapsedMs: number) => void
  onNext: () => void
}
```
`PracticePage` の `<section className="practice-card">` 直後（topline の前）に挿入:
```tsx
        <DifficultyFilterBar value={difficulty} onChange={onSetDifficulty} />
```
分割代入に `difficulty, onSetDifficulty` を追加。新コンポーネント:
```tsx
const DIFFICULTY_FILTERS: DifficultyFilter[] = ['mix', 'starter', 'standard', 'advanced', 'limit']

function DifficultyFilterBar({
  value, onChange,
}: { value: DifficultyFilter; onChange: (d: DifficultyFilter) => void }) {
  return (
    <div className="difficulty-bar" role="group" aria-label="難易度フィルタ">
      {DIFFICULTY_FILTERS.map((d) => (
        <button
          key={d}
          type="button"
          className={`difficulty-chip ${value === d ? 'is-active' : ''}`}
          aria-pressed={value === d}
          onClick={() => onChange(d)}
        >
          {difficultyLabel(d)}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: difficultyLabel を共有モジュール化**

`src/domain/difficulty-label.ts` を新規作成:
```ts
import type { DifficultyFilter } from './types'

export function difficultyLabel(d: DifficultyFilter): string {
  const labels: Record<DifficultyFilter, string> = {
    mix: 'ミックス',
    starter: '初級',
    standard: '標準',
    advanced: '応用',
    limit: '満貫以上',
  }
  return labels[d]
}
```
`App.tsx` 内の既存 `difficultyLabel`（737-746行付近, `Difficulty` 専用）を削除し、上記 import を使用（`difficulty difficulty--${question.difficulty}` の表示は `difficultyLabel(question.difficulty)` でそのまま動く）。

- [ ] **Step 5: Home 文言を更新**

`Home` コンポーネント（140-195行付近）の `eyebrow`/`lead` を変更:
```tsx
        <p className="eyebrow">無制限ランダム出題</p>
        <h1>牌姿を見て、役・翻・符・支払いまで一気に鍛える。</h1>
        <p className="lead">
          難易度を選んで、ランダムに生成される問題をずっと練習できます。点数計算は検証済みエンジンが採点します。
        </p>
```

- [ ] **Step 6: 難易度チップの CSS を追記**

`src/App.css` の末尾に:
```css
.difficulty-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.difficulty-chip {
  min-height: 44px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--tile-edge, #cdb88e);
  background: var(--surface, #fffaf0);
  color: var(--text, #1f2d24);
  font-weight: 600;
}
.difficulty-chip.is-active {
  background: var(--brass, #a86e1d);
  color: #fffaf0;
  border-color: var(--brass, #a86e1d);
}
```

- [ ] **Step 7: 型チェック・ビルド・lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: PASS（未使用 import の削除を含め解消）。

- [ ] **Step 8: 動作確認（手動）**

Run: `npm run dev`、ブラウザで `/practice` を開く。
Expected: 難易度チップを切替えると問題が変わる。「次の問題へ」で毎回別問題。「採点する」「答えを見る」「終了して結果へ」が従来どおり動く。確認後サーバ停止。

- [ ] **Step 9: コミット**

```bash
git add src/App.tsx src/App.css src/domain/questions.ts src/domain/difficulty-label.ts
git commit -m "feat: infinite random practice stream with difficulty filter"
```

---

## Task 14: 全体検証と独立検証ワークフロー

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト・lint・ビルド**

Run: `npm run test && npm run lint && npm run build`
Expected: すべて PASS。

- [ ] **Step 2: 独立検証ワークフロー（ultracode）**

固定 seed 群（例: 1〜50）で `generate('mix', createRng(seed))` → `buildQuestion` を実行し、各問題の牌姿・状況・engine 出力（役/翻/符/支払い）を書き出すスクリプトを一時的に作成（または vitest の `it` 内で `console.log`）。生成サンプルを別エージェント群に渡し、手計算で役・翻・符・支払いを再導出して engine 出力と突合、相違・非現実的な手・整合性違反を報告させる。重大な相違が出たら該当モジュール（多くは generator のアーキタイプ、稀に yaku-map）を修正。

- [ ] **Step 3: 受け入れ基準の確認**

仕様書 §14 の各項目（無限ランダム出題／engine一致／矛盾手ゼロ／実戦的レンジ／lint・test・build 緑／独立検証で重大相違なし）を満たすことを確認。

- [ ] **Step 4: ブランチ完了処理**

REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch を使い、マージ/PR/クリーンアップの方針をユーザーに確認する。
