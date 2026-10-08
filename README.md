# 数学ストック

将来「模試を作る仕事」に就くための知識を蓄える、高校数学の学習PWAです。学校数学（教科書の基礎概念）から入試レベルまでを、出題者目線のメタデータ付きで学べます。

## 主な機能

- **3難易度 × 3形式**: 学校数学 / 応用 / 入試 × 選択式 / マーク式（共通テスト形式）/ 記述式
- **出題者メタデータ**: 出題のねらい、問う力、学習指導要領の単元、想定正答率とIRTパラメータ、選択肢ごとの誤答の狙い、改題の方向性、自分の出題メモ
- **誤答パターン照合**: 選んだ誤答から典型的な誤りを特定し、土台となる概念ページへ誘導
- **記述式の自動採点**: 採点基準ごとに Claude が部分点を付与（テキスト入力または答案写真）。オフライン時はキーワード照合の簡易採点
- **擬似全国偏差値・ランク**: IRT（2PL, EAP推定）で能力値を推定し偏差値に換算。難易度・形式・単元別にも表示
- **忘却曲線の復習**: 間違えた問題・自信がなかった問題を FSRS で再出題
- **PWA**: ホーム画面から起動、全教材をオフラインで利用可能

## 技術スタック

Vite 8 / React 19 / TypeScript / Tailwind CSS v4 / vite-plugin-pwa (Workbox) / KaTeX + marked / Dexie (IndexedDB) / Zustand / ts-fsrs / Recharts / Zod / Cloudflare Pages Functions + Claude API

## 開発

```bash
npm install
npm run dev        # 教材をビルドして開発サーバーを起動
npm test           # 単体テスト（採点・IRT・FSRS・DB・教材整合性）
npm run build      # 型チェック + 本番ビルド（dist/）
```

AI採点APIをローカルで試す場合は `.env.example` を参考に `.dev.vars` を作成し、`npm run build && npx wrangler pages dev` を実行します。

## デプロイ（Cloudflare Pages）

1. Cloudflare Pages でこのリポジトリを接続（ビルドコマンド `npm run build`、出力 `dist`）
2. 環境変数に `ANTHROPIC_API_KEY` と `GRADER_ACCESS_TOKEN` を暗号化して設定
3. アプリの「設定 > 記述式のAI採点」に `GRADER_ACCESS_TOKEN` と同じ値を入力

## ディレクトリ構成

```
content/            教材の原稿（YAML: 単元・概念・誤答パターン・問題）
scripts/            教材ビルド（Zod検証・TeX構文検査 → public/data/*.json）、アイコン生成
functions/api/      記述式AI採点API（Cloudflare Pages Functions）
src/domain/         採点・IRT・FSRS・スキーマ（React/DBに依存しない純粋ロジック）
src/data/           IndexedDB・教材取得・AI採点クライアント
src/features/       画面（home / catalog / practice / review / dashboard / author-view / settings）
tests/unit/         Vitest
```

## 問題の追加

`content/problems/<科目>/<単元>/` に YAML を追加して `npm run content` を実行します（誤答パターンは `content/misconceptions/<単元ID>.yaml`、出力を書き換えずに検証だけするときは `npm run content:check`）。既存ファイルを書式見本にしてください。未定義の概念・誤答パターンの参照、TeX の構文エラー、正解IDの不整合はビルド時にエラーになります。
