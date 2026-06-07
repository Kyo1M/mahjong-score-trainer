# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Mリーグ準拠の麻雀点数計算（成立役・翻・符・支払い）を練習する静的SPA。React 19 + TypeScript + Vite。ログイン・バックエンド・長期保存なし。

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc -b で型チェック → vite build（型エラーがあればビルド失敗）
npm run lint     # eslint（flat config, dist は除外）
npm run test     # vitest run（一回実行）
npm run preview  # ビルド済みをプレビュー
```

単一テスト・watch:

```bash
npx vitest                                  # watch モード
npx vitest run src/domain/scoring.test.ts   # ファイル指定
npx vitest run -t "accepts the canonical"   # テスト名で絞り込み
```

検証は README どおり `npm run lint` → `npm run test` → `npm run build` の順。

## アーキテクチャ（最重要）

**採点エンジンは存在しない。** 翻・符・支払いを*計算する*コードはどこにもない。問題は `src/domain/questions.ts` に人手で記述し、正解（役・翻・符・支払いのタプル）を `acceptedInterpretations` / `canonicalInterpretation` として事前に埋め込む。`src/domain/scoring.ts` の `evaluateAnswer` はユーザーの選択をその正解集合と*照合するだけ*。これは設計上の意図的な選択（DESIGN.md: ランダム生成は後続のエンジン機能）。

データの流れ:

- `questions.ts` — 問題バンク。各 `PracticeQuestion` は `options`（選択肢）と `acceptedInterpretations`（複数の正解解釈を許容）+ `canonicalInterpretation`（フィードバックに表示する代表解）を持つ。
- `scoring.ts` — `evaluateAnswer`（照合）と `calculateStats`（セッション集計）。役は順不同の集合一致、翻・符・支払いはいずれかの accepted 解釈とのキー完全一致。
- `types.ts` — ドメイン型の単一の出所。
- `App.tsx` — 全UIと全ルート（`/`, `/practice`, `/guide`, `/results`）を1ファイルに集約。react-router の `BrowserRouter` は `main.tsx`。
- `tiles.ts` / `TileView.tsx` — 牌コード → SVGパス・日本語ラベルの変換と描画。

### キーが契約（編集時に最も壊しやすい点）

yaku / han / fu / payment の各キーは**文字列**で、`options.*` の選択肢と `acceptedInterpretations` / `canonicalInterpretation` の間で一致していなければならない。問題を追加・編集するときは、選択肢と正解解釈でキーを揃えること。`scoring.test.ts` が「canonical のキーが options に存在する」「canonical 解が完全正解として評価される」を検証する。

### `fuRequired` の三点連動

満貫以上の手は `fuRequired: false`。この値は3か所に波及し、変更するなら全部を同時に触る必要がある:

1. `scoring.ts` — `fuRequired` が false なら符は常に正解扱い。完全正解判定でも符を `'not-needed'` に正規化。
2. `App.tsx`（`PracticePage`）— 符の選択肢を `not-needed` 1つに固定し、提出時に `fuKey: 'not-needed'` を補う。
3. `scoring.ts`（`calculateStats`）— 符正答率の母数から `fuRequired: false` の問題を除外（`fuRate` は対象問題が無ければ `null`）。

### テストはデータ検証器

`scoring.test.ts` は照合ロジックだけでなく、手書きの問題バンクの整合性検証を兼ねる: 14枚ちょうど（手牌 + 和了牌 + 副露牌）、同一牌4枚以下（赤5は5に正規化して数える）、canonical の選択可能性と完全正解性、満貫以上で符不要。問題を追加したら必ず `npm run test` を通す。

## ドメイン規約

- **ドラは役ではない。** `options.yaku` に入れず、翻内訳（`yaku` 配列）と解説にのみ表示する（README・DESIGN・UIの注記すべてで一貫）。
- **Mリーグ準拠ルール:** 切り上げ満貫あり（30符4翻・60符3翻は満貫）、数え役満なし（三倍満が上限）、連風牌の雀頭は2符、個別ダブル役満なし。これらは問題データとガイド（`App.tsx` の `GuidePage`）に埋め込まれている。
- **牌コード:** `'3m'`/`'0p'`（赤5）/`'1z'`–`'7z'`（字牌）/`'back'`。一覧は `tiles.ts` の `TileCode` と2つのマップ参照。
- **ガイドアンカー:** 問題の `guideAnchors` は `/guide#<id>` にリンクする。`GuidePage` の section id と `App.tsx` の `guideLabel` マップを同期させること。
- **状態:** セッション状態（現在の問題index + 回答済み）を `sessionStorage`（キー `mahjong-score-trainer-session-v2`）に保存。バックエンドなし。`PracticePage` の `key={question.id}` は問題ごとに再マウントしてローカル回答状態をリセットするため。

## 素材

牌SVGは公開ドメインの `FluffyStuff/riichi-mahjong-tiles`（`public/tiles/`）。出典・ライセンスは `THIRD_PARTY_NOTICES.md`。UI/UX方針とデザイントークンは `DESIGN.md`。
