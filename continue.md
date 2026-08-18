# SiteProbe 開発ログ / 継続ガイド

## 最終更新: 2026-02-16
## 最新コミット: `945c7d7` (main)
## 本番デプロイ: ● Ready (Vercel)

---

## 現在の機能一覧

### コア機能（MVP）
- **16ペルソナAI分析**: Gemini 2.0 Flashによる多角的Webサイト分析
- **スコアダッシュボード**: 100点満点（減点方式）、5カテゴリレーダーチャート
- **優先改善サマリー**: 全ペルソナ横断の重要度別改善提案（アコーディオン式）
- **共有・エクスポート**: URL共有、JSON/テキストレポート出力
- **履歴管理**: localStorage保存（max 20件、FIFO自動削除）

### 新機能（直近セッションで実装）
1. **AI改善ロードマップ** (`8384f99`)
   - ルールベースで工数・スコア影響を推定
   - Phase 1（即効性）/ Phase 2（中期）に分類
   - アコーディオンUI、初期状態で全Phase閉じ

2. **スコア推移トレンド** (`8384f99`)
   - 同一URLの分析履歴をRechartsで折れ線グラフ表示
   - 専用Zustandストア（trend-store.ts）で永続化

3. **複数競合比較** (`8384f99` + `8fb523e`)
   - 最大3社の競合サイトを同時比較
   - 1社目: 16ペルソナ詳細分析 + 簡易スコア（「詳細分析」バッジ）
   - 2-3社目: カテゴリ別簡易スコア（「簡易分析」バッジ）
   - レーダーチャートで全社比較、強み/弱み一覧

4. **ペルソナチャット** (`8384f99`)
   - 各ペルソナに質問できるチャット機能
   - 分析コンテキストを保持した対話

### バグ修正（直近セッション）
- `8fb523e` 1社目の競合がダッシュボードに表示されない問題を修正
- `6937849` 競合バナーに全URLを明示表示 / ロードマップPh1を初期閉じ
- `945c7d7` 競合比較・スコア推移をペルソナ結果カードの下に配置
- React key重複エラー修正（roadmap-view.tsx）

---

## 画面レイアウト（分析結果ページ）

```
1. 競合比較バナー（全URL明示）
2. スコアダッシュボード（総合スコア + カテゴリ別レーダー）
3. 優先改善サマリー（重要度別アコーディオン）
4. 改善ロードマップ（Phase 1/2 アコーディオン、初期閉じ）
5. [モバイル] ペルソナ一覧ボタン
6. ペルソナ結果カード（分析詳細 + 「〇〇に質問する」チャット）
7. 競合比較ダッシュボード（レーダーチャート + 強み/弱み）
8. スコア推移グラフ（最下部）
```

---

## 技術スタック

| 領域 | 技術 |
|------|------|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイル | Tailwind CSS + shadcn/ui |
| 状態管理 | Zustand (analysis, persona, history, trend, chat) |
| AI | Gemini 2.0 Flash (google/generative-ai) |
| チャート | Recharts |
| スクレイピング | cheerio (Edge Runtime互換) |
| 並列制御 | p-limit(3) |
| デプロイ | Vercel |
| 永続化 | localStorage |

---

## ファイル構成（主要ファイル）

```
src/
├── types/index.ts                     # 全型定義
├── data/default-personas.ts           # 16ペルソナ + カテゴリ設定
├── lib/
│   ├── gemini.ts                      # Gemini API（分析・チャット・アシスト）
│   ├── scraper.ts                     # cheerioスクレイパー
│   ├── validators.ts                  # URL検証・SSRF対策
│   ├── rate-limiter.ts                # レート制限
│   ├── roadmap.ts                     # ロードマップ生成ロジック
│   ├── export-text.ts                 # テキストレポート生成
│   └── share.ts                       # 共有URL圧縮
├── stores/
│   ├── analysis-store.ts              # 分析状態管理
│   ├── persona-store.ts               # ペルソナ管理
│   ├── history-store.ts               # 履歴管理
│   ├── trend-store.ts                 # スコア推移データ
│   └── chat-store.ts                  # チャット履歴
├── hooks/
│   ├── use-analysis.ts                # 分析オーケストレーション
│   └── use-elapsed-time.ts            # 経過時間
├── app/
│   ├── page.tsx                       # トップページ（URL入力）
│   ├── analyze/[id]/page.tsx          # 分析結果ページ
│   ├── history/page.tsx               # 履歴一覧
│   ├── personas/                      # ペルソナ管理
│   └── api/
│       ├── scrape/route.ts            # スクレイピングAPI
│       ├── analyze/persona/route.ts   # ペルソナ分析API
│       ├── analyze/competitor-quick/  # 競合簡易分析API
│       ├── chat/persona/route.ts      # チャットAPI
│       └── assist/persona/route.ts    # ペルソナ自動生成API
└── components/analysis/
    ├── url-input-form.tsx             # URL入力（競合URL含む）
    ├── analysis-progress.tsx          # 分析進捗
    ├── score-dashboard.tsx            # スコアダッシュボード
    ├── persona-sidebar.tsx            # ペルソナ一覧サイドバー
    ├── persona-result-card.tsx        # ペルソナ結果カード
    ├── persona-chat.tsx               # チャットUI
    ├── chat-markdown.tsx              # チャットMarkdownレンダラ
    ├── priority-summary.tsx           # 優先改善サマリー
    ├── roadmap-view.tsx               # 改善ロードマップ
    ├── trend-chart.tsx                # スコア推移グラフ
    └── competitor-dashboard.tsx       # 競合比較ダッシュボード
```

---

## 既知の制約・注意点

- **Gemini 15 RPM制限**: p-limit(3)で並列度制御。16ペルソナ分析は約30秒
- **Vercel 10秒タイムアウト**: クライアントサイドで個別APIリクエストを発行して回避
- **Edge Runtime**: APIルートで使用。cheerioはEdge互換だが、Node.js専用ライブラリは使えない
- **localStorage 4MB制限**: 履歴max 20件、FIFO自動削除で対応
- **既存履歴の競合表示**: 修正前に保存された履歴は1社目の競合スコアがない（再分析で解決）
- **shadcn toast非推奨**: sonnerを使用すること

---

## 次に着手可能な改善案

### UI/UX
- [ ] ダークモード対応
- [ ] モバイルレスポンシブの細かい調整
- [ ] 分析中のスケルトンローディング改善

### 機能
- [ ] PDF出力機能
- [ ] ペルソナのカスタムプロンプト編集
- [ ] 分析結果のフィルタリング・検索
- [ ] 競合比較の差分ハイライト

### 技術的改善
- [ ] E2Eテスト（Playwright）
- [ ] エラーバウンダリの追加
- [ ] API応答のキャッシュ（同一URL短期間再分析の節約）
- [ ] Gemini APIのストリーミング対応（体感速度改善）
