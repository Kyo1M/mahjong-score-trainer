# Mahjong Score Trainer

Mリーグ準拠の麻雀点数計算を、牌姿から「成立役・翻・符・支払い点」まで練習するWebアプリです。

## Current MVP

- ログインなし、長期履歴なしの静的SPA
- 検証済み固定問題による総合練習
- 成立役、翻、符、支払い点の部分採点
- 1問ごとの即時解説
- 任意終了によるセッション結果
- 点数計算ガイド
- 公開ドメインのSVG牌画像を同梱

全役ランダム生成、長期成績、SNS共有、ルール設定、PWAオフラインキャッシュはMVP後の対象です。

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run test
npm run build
```

## Project Notes

- UI/UX方針は `DESIGN.md` に記載しています。
- 牌素材の出典とライセンスは `THIRD_PARTY_NOTICES.md` に記載しています。
- 問題データは `src/domain/questions.ts`、回答評価と集計は `src/domain/scoring.ts` にあります。
- ドラは成立役の選択肢には含めず、翻内訳として解説に表示します。
- 問題データの牌枚数、5枚目禁止、正解選択肢の存在は `src/domain/scoring.test.ts` で検証します。
