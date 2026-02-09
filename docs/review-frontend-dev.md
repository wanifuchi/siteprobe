# フロントエンド実装レビュー (frontend-dev)

## 概要

要件定義書 (`requirements.md`) をフロントエンド実装の専門視点からレビューした結果を以下にまとめる。

---

## 1. UI/UX実装の実現性

### 1.1 Next.js 15 App Router + shadcn/ui でのコンポーネント設計

**判定: 実現可能（適切な技術選定）**

- Next.js 15 App Router は Server Components / Client Components の使い分けが鍵となる
- shadcn/ui は Radix UI ベースで、Tabs, Progress, Dialog, Card, Badge 等、必要なコンポーネントがすべて揃っている
- Tailwind CSS との組み合わせにより、一貫したデザインシステムを構築可能

**注意点**:
- 分析結果ページやストリーミング表示は Client Component になるため、`"use client"` ディレクティブの適切な境界設計が必要
- Server Components で静的部分（レイアウト、ナビゲーション等）を、Client Components でインタラクティブ部分を担当する設計を推奨

### 1.2 プログレスバーのリアルタイム更新方式

**判定: 実現可能（実装方式の選定が重要）**

**推奨方式: ペルソナ単位の個別APIリクエスト + クライアント側並列管理**

```
クライアント
  ├─→ POST /api/analyze (サイトデータ取得・共通前処理)
  │      └─→ 応答: { analysisId, siteData }
  │
  └─→ 各ペルソナごとに POST /api/analyze/persona
       ├─→ ペルソナ1 (並列1)
       ├─→ ペルソナ2 (並列2)
       ├─→ ペルソナ3 (並列3)
       └─→ ... (並列度制限: 3-4同時)
```

**この方式の利点**:
- 各リクエストが1ペルソナ分で完結 → **Vercel Serverless 10秒制限に収まる**
- クライアント側でプログレス管理が容易（完了数/全体数）
- 各ペルソナの結果を受信次第、即座にUIに反映可能
- 並列度をクライアント側で制御でき、Gemini RPM制限への対応も容易

**全体進捗バー**: `完了ペルソナ数 / 有効ペルソナ総数 × 100%`
**個別進捗**: `待機中 → 分析中（スピナー） → 完了（チェックマーク）`
**経過時間**: クライアント側 `setInterval` でカウントアップ

### 1.3 ストリーミング表示（分析過程のリアルタイム表示）

**判定: 実現可能（2段階で対応推奨）**

**MVP段階**: ペルソナ単位の結果表示（ストリーミングなし）
- 各ペルソナのAPIリクエストが完了次第、結果を一括表示
- 実装がシンプルで確実

**拡張段階**: ペルソナ内のストリーミング表示
- Gemini API の streaming response をそのまま中継
- Route Handler で `ReadableStream` を返す

```typescript
// app/api/analyze/persona/route.ts
export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Gemini API streaming
      const geminiStream = await gemini.generateContentStream(prompt);
      for await (const chunk of geminiStream) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

### 1.4 分析完了ペルソナから順次結果表示

**判定: 実現可能（推奨方式と完全に合致）**

- ペルソナ単位の個別APIリクエスト方式により、自然に実現される
- 完了したペルソナの結果は即座に state に追加 → UIに反映
- 未完了ペルソナはスケルトンUI or 「分析中...」プレースホルダーを表示
- ユーザーは完了済みのペルソナタブを先にクリックして結果を閲覧可能

---

## 2. 状態管理の提案

### 2.1 推奨: Zustand + localStorage ミドルウェア

**選定理由**:
- 複数ペルソナの並列分析状態は複雑になるため、`useState` / `useReducer` 単体では管理が煩雑
- Zustand は軽量（1KB未満）でボイラープレートが少なく、Next.js App Router と相性が良い
- `persist` ミドルウェアで localStorage との同期が宣言的に書ける
- Redux は過剰、Context API は再レンダリング問題がある

### 2.2 ストア設計

```typescript
// stores/analysisStore.ts
interface AnalysisState {
  // 分析実行状態
  status: 'idle' | 'preparing' | 'analyzing' | 'completed' | 'error';
  analysisId: string | null;
  url: string;
  startedAt: number | null;

  // ペルソナ別進捗
  personaResults: Record<string, {
    status: 'waiting' | 'analyzing' | 'completed' | 'error';
    result: AnalysisResult | null;
    error: string | null;
    streamingText: string; // ストリーミング中の途中テキスト
  }>;

  // アクション
  startAnalysis: (url: string, personas: Persona[]) => void;
  updatePersonaStatus: (personaId: string, status: PersonaStatus) => void;
  setPersonaResult: (personaId: string, result: AnalysisResult) => void;
  reset: () => void;
}

// stores/personaStore.ts (localStorage永続化)
interface PersonaState {
  personas: Persona[];
  addPersona: (persona: Persona) => void;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  deletePersona: (id: string) => void;
  togglePersona: (id: string) => void;
}

// stores/historyStore.ts (localStorage永続化)
interface HistoryState {
  analyses: AnalysisHistory[];
  addAnalysis: (analysis: AnalysisHistory) => void;
  deleteAnalysis: (id: string) => void;
  clearHistory: () => void;
}
```

### 2.3 localStorage との同期

```typescript
import { persist, createJSONStorage } from 'zustand/middleware';

const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      personas: DEFAULT_PERSONAS,
      // ...actions
    }),
    {
      name: 'siteprobe-personas',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**注意: localStorage 容量管理が必須**（後述の懸念点参照）

---

## 3. コンポーネント設計

### 3.1 主要コンポーネント一覧

#### レイアウト層

| コンポーネント | パス | 責務 |
|---|---|---|
| `RootLayout` | `app/layout.tsx` | テーマプロバイダー、フォント、メタデータ |
| `Header` | `components/layout/header.tsx` | ロゴ、ナビゲーション |
| `Footer` | `components/layout/footer.tsx` | フッターリンク |

#### ページコンポーネント

| コンポーネント | パス | 責務 |
|---|---|---|
| `HomePage` | `app/page.tsx` | URL入力フォーム、サービス説明 |
| `AnalyzePage` | `app/analyze/[id]/page.tsx` | 分析結果表示（メイン） |
| `ProcessPage` | `app/analyze/[id]/process/page.tsx` | 分析過程詳細 |
| `PersonasPage` | `app/personas/page.tsx` | ペルソナ一覧・管理 |
| `PersonaFormPage` | `app/personas/new/page.tsx` | ペルソナ作成 |
| `PersonaEditPage` | `app/personas/[id]/edit/page.tsx` | ペルソナ編集 |
| `HistoryPage` | `app/history/page.tsx` | 分析履歴一覧 |
| `SharePage` | `app/share/[shareId]/page.tsx` | 共有結果閲覧 |

#### UIコンポーネント（機能別）

| コンポーネント | 責務 |
|---|---|
| `UrlInputForm` | URL入力 + バリデーション + 分析開始ボタン |
| `PersonaSelector` | 分析に使用するペルソナの選択チェックボックス |
| `AnalysisProgress` | 全体プログレスバー + 経過時間表示 |
| `PersonaProgressList` | 個別ペルソナの状態一覧（待機/分析中/完了） |
| `AnalysisResultTabs` | ペルソナ別結果のタブ切り替え |
| `PersonaResultCard` | 個別ペルソナの分析結果カード |
| `RecommendationList` | 改善提案リスト（優先度バッジ付き） |
| `ScoreDashboard` | 総合スコア + カテゴリ別スコア表示 |
| `StreamingTextView` | ストリーミングテキストの段階的表示 |
| `PersonaCard` | ペルソナ情報表示カード |
| `PersonaForm` | ペルソナ作成/編集フォーム |
| `HistoryList` | 分析履歴一覧 |
| `ExportMenu` | PDF/JSONエクスポートメニュー |
| `ShareDialog` | 共有URL生成ダイアログ |
| `ErrorBoundary` | エラーフォールバックUI |

#### カスタムフック

| フック | 責務 |
|---|---|
| `useAnalysis` | 分析の実行制御（並列リクエスト管理、進捗追跡） |
| `usePersonas` | ペルソナCRUD操作 + localStorage同期 |
| `useAnalysisHistory` | 分析履歴の読み書き + 容量管理 |
| `useStreamingResponse` | fetch streaming responseの処理 |
| `useElapsedTime` | 経過時間のカウントアップ |

### 3.2 ペルソナ管理画面のCRUD UI

**一覧画面** (`/personas`):
- カードグリッド表示（デスクトップ: 3列、タブレット: 2列、モバイル: 1列）
- 各カードに名前、専門分野、有効/無効トグルスイッチ
- デフォルトペルソナとカスタムペルソナを視覚的に区別（バッジ）
- 「新規作成」ボタン → `/personas/new` へ遷移
- カスタムペルソナのみ編集/削除ボタンを表示

**作成/編集フォーム**:
- shadcn/ui の `Form` + `Input` + `Textarea` + `Select`
- フィールド: 名前、専門分野、分析観点（Textarea）、アイコン選択
- リアルタイムバリデーション（zod + react-hook-form）
- プレビュー表示（入力内容がカードとしてどう見えるかのプレビュー）

**削除**:
- 確認ダイアログ（shadcn/ui `AlertDialog`）
- デフォルトペルソナは削除不可（無効化のみ）

### 3.3 レスポンシブ対応の方針

**ブレークポイント** (Tailwind CSS デフォルト):
- `sm`: 640px（モバイル横）
- `md`: 768px（タブレット）
- `lg`: 1024px（デスクトップ）
- `xl`: 1280px（ワイドデスクトップ）

**重要な対応ポイント**:

1. **ペルソナ結果タブ（16ペルソナ問題）**:
   - デスクトップ: 横スクロール可能なタブバー
   - モバイル: ドロップダウンセレクト or アコーディオンに変更
   - **推奨**: モバイルではタブの代わりにセレクトボックス + カード表示

2. **分析プログレスリスト**:
   - デスクトップ: 2列グリッド
   - モバイル: 1列リスト（コンパクト表示）

3. **URL入力フォーム**:
   - 全幅入力フィールド + 下にボタン（モバイル）
   - 横並びレイアウト（デスクトップ）

---

## 4. PDF出力の実装方式

### 4.1 ライブラリ選択

**推奨: `@react-pdf/renderer`（主要）+ `jspdf`（代替）**

| ライブラリ | 長所 | 短所 |
|---|---|---|
| `@react-pdf/renderer` | React コンポーネントでPDFを定義、柔軟なレイアウト | 日本語フォント登録が必要、バンドルサイズ大 |
| `jspdf` + `jspdf-autotable` | 軽量、テーブル出力に強い | レイアウト自由度が低い |
| `html2pdf.js` (`html2canvas` + `jspdf`) | 画面そのままPDF化 | 品質が低い、大きなページでメモリ不足 |

**日本語フォント対応**:
- `@react-pdf/renderer` は Noto Sans JP 等のフォントファイル登録が必須
- フォントファイルは CDN から動的ロード or バンドルに含める
- バンドルに含めるとサイズが大きくなるため、CDN推奨

### 4.2 PDF構成案

**通常版PDF**:
1. 表紙（サイト名、URL、分析日時、総合スコア）
2. エグゼクティブサマリー（全ペルソナの主要指摘まとめ）
3. カテゴリ別スコア概要
4. ペルソナ別分析結果（各ペルソナ1-2ページ）
   - スコア、主要所見、改善提案（優先度付き）

**詳細版PDF（分析過程含む）**:
- 上記に加え、各ペルソナの「分析思考過程」セクションを追加
- データ量が非常に大きくなる可能性 → **ブラウザメモリ消費に注意**
- 16ペルソナ × 分析過程 → 50ページ以上になる可能性あり
- **推奨**: 詳細版は対象ペルソナを選択してエクスポートする機能を追加

---

## 5. 共有URL機能の実装

### 5.1 Base64 + lz-string の実現性

**判定: 現実的ではない（データ量が大きすぎる）**

**根拠**:
- 16ペルソナの分析結果 + スコア + 改善提案 → 推定 50KB-200KB（JSON）
- lz-string で圧縮しても 30-60% → 15KB-120KB
- Base64 エンコードで 33% 増加 → 20KB-160KB
- URL の実用的な最大長は **2,083文字**（IE互換）/  **約8KB**（モダンブラウザ）
- **どちらの場合もデータ量が超過する**

### 5.2 推奨実装

**MVP段階**: 共有機能はスコープ外とするか、localStorage IDベースの同一ブラウザ参照のみ

**本格実装段階**:
- **Vercel KV** (Free Tier: 256MB, 30K requests/月) を使用
- 分析結果を保存 → ランダムID生成 → `/share/{id}` でアクセス
- TTL（有効期限）を設定（例: 30日）して容量を管理

```typescript
// app/api/share/route.ts
import { kv } from '@vercel/kv';

export async function POST(req: Request) {
  const { analysisResult } = await req.json();
  const shareId = generateId(); // nanoid等
  await kv.set(`share:${shareId}`, analysisResult, { ex: 60 * 60 * 24 * 30 }); // 30日
  return Response.json({ shareUrl: `/share/${shareId}` });
}
```

**代替案**: Supabase Free Tier（500MB PostgreSQL）に保存

---

## 6. 抜け漏れている要件・UI上の懸念点

### 6.1 重大な技術的制約（要件見直し必須）

#### (A) Vercel Serverless 10秒タイムアウト制限

**問題**: 要件では「時間制限なし、詳細で高品質な分析を優先」とあるが、Vercel Free Tier の Serverless Functions は **10秒でタイムアウト** する。16ペルソナの並列分析を1リクエストで処理することは不可能。

**対策（前述の通り）**: ペルソナ単位の個別APIリクエスト方式に変更。各リクエストは1ペルソナ分のみ処理するため10秒以内に完了可能。

#### (B) Gemini API レート制限

**問題**: Gemini 2.0 Flash 無料枠は **15 RPM**（1分間に15リクエスト）。16ペルソナを同時並列で呼び出すと制限に抵触する。

**対策**: クライアント側で並列度を **3-4** に制限するキューイング機構を実装。`p-limit` ライブラリ or カスタム実装。

```typescript
import pLimit from 'p-limit';
const limit = pLimit(4); // 最大4並列

const results = await Promise.all(
  enabledPersonas.map(persona =>
    limit(() => analyzeWithPersona(persona, siteData))
  )
);
```

#### (C) スクリーンショット取得の実現性

**問題**: F-001で「スクリーンショット取得（デスクトップ/モバイル）」とあるが、Vercel Serverless では Puppeteer/Playwright を動かすのが困難（メモリ制限、バイナリサイズ制限）。

**対策案**:
1. **PageSpeed Insights API** のスクリーンショットを利用（無料・制限あり）
2. **スクリーンショット取得をMVPスコープから除外** し、将来的に外部サービス連携で対応
3. Vercel の `@vercel/og` で簡易的なサムネイル生成（サイトのキャプチャではない）

**推奨**: MVP段階ではスクリーンショット取得を除外し、代わりにPageSpeed Insights APIのデータを活用

#### (D) Lighthouse指標取得

**問題**: 自前でLighthouse を実行するにはブラウザ環境が必要で、Serverlessでは不可能。

**対策**: **PageSpeed Insights API**（無料）を使用。Google が提供する公式APIで、Lighthouse のデータをJSON で取得できる。ただし利用頻度制限があるため、結果のキャッシュが必要。

### 6.2 要件に不足しているUI要件

| 項目 | 内容 | 優先度 |
|---|---|---|
| **エラーハンドリングUI** | 無効URL、API障害、スクレイピング失敗、ネットワークエラー時の表示 | 高 |
| **分析キャンセル機能** | 分析中にユーザーが中断する手段 | 高 |
| **ページ離脱警告** | 分析中のブラウザ閉じ/リロード時の確認ダイアログ | 中 |
| **ローディング/スケルトンUI** | 各画面の初期読み込み時のプレースホルダー | 中 |
| **URL入力のUX強化** | プロトコル自動補完、形式バリデーション、入力例プレースホルダー | 中 |
| **ダークモード** | shadcn/ui対応済みのため追加コスト小。現代的UIとして推奨 | 低 |
| **トースト通知** | 操作完了・エラー発生時のフィードバック | 中 |
| **空状態のUI** | 履歴なし、ペルソナなし等の空状態表示 | 中 |

### 6.3 localStorage容量の懸念

**問題**: localStorage の容量は通常 **5-10MB**。

**試算**:
- 1回の分析結果（16ペルソナ分析 + 分析過程）: 約 200KB-500KB
- 10回分析: 2MB-5MB → **上限に近づく**
- 20回分析: 容量超過の可能性大

**対策（必須）**:
1. 分析過程（思考プロセス）は分析結果と分けて保存し、古いものから自動削除
2. 保存前に容量チェック → 上限に近い場合は古い履歴の削除を提案
3. 分析結果のサマリーのみ保存し、詳細は閲覧時に再生成（非現実的なのでやはり容量管理が重要）
4. 履歴の最大保持件数を設定（例: 最新20件）
5. IndexedDB への移行を検討（容量制限が緩い: 数百MB-数GB）

### 6.4 レスポンシブでの16ペルソナタブ表示

**問題**: 16個のタブは標準的な画面幅では表示しきれない。

**対策**:
- **デスクトップ**: 横スクロール可能なタブバー（左右矢印ボタン付き）
- **タブレット**: 2行に折り返すタブバー or 横スクロール
- **モバイル**: `Select` コンポーネントでドロップダウン選択に切り替え

### 6.5 アクセシビリティ

要件定義にアクセシビリティペルソナ(P-07)がいるにもかかわらず、サービス自体のアクセシビリティ要件が定義されていない。

**最低限必要な対応**:
- キーボードナビゲーション（tabフォーカス、Enter/Space操作）
- `aria-live` 領域（ストリーミング更新、プログレス更新の通知）
- 十分なカラーコントラスト比（WCAG 2.1 AA基準: 4.5:1）
- スクリーンリーダー対応（適切な `aria-label`、ランドマーク）
- shadcn/ui (Radix UI) はアクセシビリティ対応が組み込まれているため、カスタムコンポーネントに注意

### 6.6 共有ページのSEO/OGP

共有URLからアクセスした場合の表示について:
- 動的OGPメタデータの生成（サイト名、総合スコア等）
- Next.js の `generateMetadata` を活用
- OGP画像の動的生成 (`@vercel/og`) は将来検討

### 6.7 オフライン/低速ネットワーク対応

要件に含まれていないが、以下の検討を推奨:
- Service Worker でのキャッシュ（PWA化）は過剰だが、分析結果のローカルキャッシュは有用
- 低速ネットワーク時のタイムアウト設定とリトライ機構

---

## 7. 実装優先度の提案

### Phase 1 (MVP)
1. URL入力 → ペルソナ選択 → 分析実行（個別APIリクエスト方式）
2. プログレスバー（全体 + 個別ペルソナ状態）
3. 分析結果タブ表示（完了順に表示）
4. デフォルトペルソナ16種のプロンプト実装
5. 分析履歴（localStorage）

### Phase 2 (機能拡充)
1. カスタムペルソナCRUD
2. ストリーミング表示（ペルソナ内の分析過程リアルタイム表示）
3. 分析過程詳細ページ
4. PDFエクスポート
5. JSONエクスポート

### Phase 3 (共有・拡張)
1. 共有URL機能（Vercel KV or Supabase）
2. ダークモード
3. PageSpeed Insights API連携
4. 分析結果の時系列比較

---

## 8. まとめ

### 実現可能な部分
- Next.js 15 + shadcn/ui のコンポーネント設計は適切
- ペルソナ単位の個別APIリクエスト方式により、Vercel制限内での実装が可能
- Zustand + localStorage persist による状態管理は堅実

### 要件修正が必要な部分
| 項目 | 現要件 | 推奨修正 |
|---|---|---|
| 分析アーキテクチャ | 暗黙的に1リクエスト並列処理 | ペルソナ単位の個別APIリクエスト方式に明記 |
| 共有URL (Base64方式) | Base64 + lz-string | Vercel KV or Supabase による永続化（MVP後） |
| スクリーンショット取得 | 自前取得 | PageSpeed Insights API利用 or MVP除外 |
| Lighthouse指標 | 自前計測 | PageSpeed Insights API利用 |
| localStorage容量 | 制限考慮なし | 容量管理機構の追加（最大件数、自動削除） |

### 追加が必要な要件
1. エラーハンドリングUIの定義
2. 分析キャンセル機能
3. ローディング/スケルトンUIの定義
4. アクセシビリティ要件の定義
5. localStorage容量管理ポリシー
6. Gemini APIレート制限への対応方針の明記
