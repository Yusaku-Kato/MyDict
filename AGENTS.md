# AGENTS.md

個人用の用語辞書 Web アプリ **MyDict**。GitHub Pages で配信する静的 SPA で、データはこのリポジトリ内の JSON ファイルとして保存する。

- 公開 URL: https://yusaku-kato.github.io/MyDict/
- リポジトリ: https://github.com/Yusaku-Kato/MyDict

## 技術スタック

| 用途 | 採用 |
| --- | --- |
| UI | Preact 11 + TypeScript |
| ビルド | Vite 8（`@preact/preset-vite`） |
| Markdown | marked + DOMPurify（サニタイズ必須） |
| 図 | Mermaid（遅延読み込み）、画像（PNG / JPEG / GIF / WebP / SVG） |
| 配信 | GitHub Pages（main ブランチの `docs/` を配信。push すると約 1 分で自動反映） |
| 書き込み | ブラウザから GitHub Git Data API へ直接コミット（Fine-grained PAT） |

## 環境のルール

- **すべてこのディレクトリ内で完結させる。** グローバルインストール（`npm i -g` など）やグローバル設定の変更はしない。CLI は `npx` でローカルの `node_modules/.bin` を使う。
- Node.js 24 系 / npm を使用。依存追加は `npm install <pkg>`（`package.json` に記録される）。

## コマンド

```sh
npm install        # 依存のインストール
npm run dev        # 開発サーバー（http://localhost:5173/MyDict/）
npm run build      # index 生成 → 型チェック → 本番ビルド（docs/assets, docs/index.html）
npm run preview    # ビルド結果の確認（http://localhost:4173/MyDict/）
npm run index      # docs/data/index.json だけ再生成
```

変更後は必ず `npm run build` が通ることを確認する（テストフレームワークは未導入。型チェックがビルドに含まれる）。

## デプロイ

GitHub Actions は使っていない（gh トークンに `workflow` スコープがないため）。**ビルド成果物を `docs/` にコミットし、Pages が main の `/docs` を配信する**方式。

1. `npm run build`（`docs/assets` と `docs/index.html` を置き換える。`docs/data` には触れない）
2. `docs/` を含めてコミットし `git push`
3. `gh api repos/Yusaku-Kato/MyDict/pages/builds/latest --jq .status` が `built` になれば反映済み

**src を変更したら必ずビルドして docs/ も一緒にコミットする。** 忘れると公開サイトに反映されない。

## ディレクトリ構成

```
docs/                         GitHub Pages の配信ルート
  index.html, assets/         ビルド成果物（npm run build で生成してコミット）
  .nojekyll                   Jekyll 処理を無効化
  data/terms/<id>.json        用語データ（1 用語 1 ファイル）
  data/images/                詳細説明で使う画像
  data/index.json             一覧用インデックス（本文以外。アプリが保存時に更新、npm run index でも再生成）
scripts/build-index.mjs       terms/*.json を検証し index.json を生成
vite.config.ts                出力先 docs/、開発時に docs/data を /MyDict/data/ で配信
src/
  main.tsx                    エントリ。キャッシュ済み一覧で即描画→裏で最新を取得
  App.tsx                     ルートごとの画面切り替え（一覧は常にマウントしたまま隠す）
  router.ts                   ハッシュルーティング（#/, #/t/<id>, #/new, #/edit/<id>, #/settings）
  store.ts                    一覧・本文のキャッシュ、先読み、保存・削除、未デプロイ分の上書き
  github.ts                   GitHub Contents API ラッパー、トークン管理
  kana.ts                     ひらがな変換・五十音の行判定・照合順序
  Markdown.tsx                Markdown 描画、Mermaid 図、画像パス解決
  pages/                      ListPage / DetailPage / EditPage / SettingsPage
```

## データ形式

`docs/data/terms/<id>.json`（ファイル名と `id` は一致させる）:

```json
{
  "id": "lq3k9x2a1b",
  "name": "用語名",
  "reading": "ようごめい",
  "summary": "概要（一覧と詳細の冒頭に表示）",
  "body": "詳細説明（Markdown）",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

- `reading` はひらがなと長音記号「ー」のみ（`/^[ぁ-ゖー\s]+$/`）。一覧はこの読みの五十音順（`Intl.Collator('ja')`）で並ぶ。
- 図: 本文中の ` ```mermaid ` コードブロックは Mermaid 図として描画。画像は `![説明](images/<ファイル名>)` で参照し、実体は `docs/data/images/` に置く。
- 用語ファイルを手で追加・編集したら `npm run index` で index.json を更新してコミットする。
- `id` は `Date.now().toString(36)` + ランダム 4 文字。

## 用語を追加するときのルール

ユーザーから「〇〇を追加して」と頼まれたときは，以下に従って `docs/data/terms/` に用語ファイルを作る．

- **用語は意味が色々ある場合，ソフトウェア工学の研究者としての意味説明にしてください．必要に応じて図を入れてください．**
  - 他分野での意味や紛らわしい用語（例: 分散モデル と 拡散モデル）は，本文の末尾で簡単に触れる程度にする．
  - 図は Mermaid を基本とし，表で済むものは Markdown の表にする．
- **句読点は「，」（全角コンマ）と「．」（全角ピリオド）を使う．「、」「。」は使わない．** 名前・概要・詳細説明（図や表の中の文章も含む）すべてに適用する．
- 構成の目安: `## 意味` → 仕組み・図 → `## ソフトウェア工学研究での使われ方` → 実装例や関連用語（必要なものだけ）．
- 論文やツールに言及するときは，著者・会議/論文誌・年など確かめられる情報だけを書く．うろ覚えの数値や書誌情報は書かない．
- 追加後は `npm run index` → `npm run build` で検証し，ブラウザで図がエラーなく描画されることを確認してからコミット・push する．

## 高速な画面遷移のための設計（崩さないこと）

1. **SPA + ハッシュルーティング**: 遷移でページを再読み込みしない。
2. **一覧データを localStorage にキャッシュ**: 起動直後にキャッシュで描画し、`index.json` は裏で再検証する。
3. **一覧画面は常にマウント**: 詳細から戻っても再描画なし、スクロール位置を復元。
4. **本文の先読み**: 用語リンクの hover / touchstart / focus で詳細 JSON を取得しておき、詳細画面は同期的に表示（`peekTerm`）。
5. **一覧データで先に描画**: 名前・読み・概要は index から即表示し、本文だけ後から差し込む。
6. **Mermaid は遅延読み込み**: 図を含む本文のときだけ `import('mermaid')`。メインバンドルに入れない。
7. View Transitions API で 120ms の短いクロスフェード。

メインバンドル（`docs/assets/index-*.js`）は gzip 50KB 以下を目安に保つ。重いライブラリは動的 import にする。

## 書き込みの仕組み

- 設定画面で保存した Fine-grained PAT（対象リポジトリのみ・Contents: Read and write）を localStorage に保持。
- 保存・削除は「用語ファイル + index.json」を Git Data API で 1 コミットにまとめる（index.json はリポジトリ上の最新版を読んで更新し、競合時は 1 度再試行）。画像追加も 1 コミット。
- main へのコミットで Pages が再デプロイされる（約 1 分）。アプリのビルドは不要（データは docs/data を直接配信）。
- デプロイ完了までは `store.ts` の `pending`（localStorage）で変更を上書き表示し、画像は raw.githubusercontent.com にフォールバックする。

## 注意事項

- GitHub Pages は公開サイトのため、**辞書の内容は誰でも閲覧可能**。書き込みはトークン保持者のみ。
- Markdown の HTML は必ず DOMPurify を通す。
- トークンをコードやコミットに含めない。
- UI の文言は日本語。

## サブエージェント

`.claude/agents/` に定義:

| 名前 | モデル | 役割 |
| --- | --- | --- |
| `frontend-dev` | `claude-sonnet-5-5` | 画面・機能の実装 |
| `code-reviewer` | `claude-opus-5-5` | 変更のレビュー（正しさ・性能・セキュリティ） |
| `term-writer` | `claude-sonnet-5-5` | 用語データ（JSON・Mermaid 図）の作成・整形 |
| `deploy-checker` | `claude-haiku-5-5` | ビルド・デプロイ状況の確認 |
