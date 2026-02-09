# システム設計レビュー - SiteProbe 要件定義書

**レビュー担当**: system-architect
**レビュー対象**: `/docs/requirements.md`
**レビュー日**: 2026-02-09

---

## 1. 技術的実現可能性の評価

### 1.1 Gemini 2.0 Flash APIでの並列分析

**結論: 条件付きで実現可能だが、重大な制約あり**

| 項目 | 詳細 |
|------|------|
| 無料枠 | 15 RPM（1分あたり15リクエスト） |
| 1回の分析 | 最大16ペルソナ = 16リクエスト |
| 日次トークン制限 | 約100万トークン/日（推定） |
| 1分析あたり推定トークン | 1万〜5万トークン |
| 1日あたり推定分析可能回数 | 20〜100回 |

**問題点**:
- 16ペルソナを同時並列実行すると、1回の分析で15 RPMの上限を超過する
- 複数ユーザーが同時に分析を実行すると即座にレート制限に到達する
- 無料枠では事実上、同時に1ユーザーしか分析できない

**推奨対策**:
- セマフォパターンで同時実行数を3〜5に制限する（`p-limit`ライブラリ等を使用）
- ペルソナの分析をバッチ実行（例: 5ペルソナ × 3バッチ + 1ペルソナ）
- リトライ時は指数バックオフを適用（1秒 → 2秒 → 4秒）
- 将来的にAPIキーごとのユーザー分離を検討

### 1.2 fetch + cheerio でのスクレイピングの制約

**結論: 静的サイトのみ対応可能。SPA/CSRサイトは分析品質が著しく低下する**

| 制約 | 影響度 | 詳細 |
|------|--------|------|
| SPA/CSRサイト | 致命的 | React/Vue/Angular等で描画されるサイトはHTML内にコンテンツがない |
| JavaScript描画 | 致命的 | JS実行が必要な動的コンテンツを取得できない |
| WAF/Bot対策 | 高 | Cloudflare等のBot検出でブロックされる場合がある |
| 認証が必要なページ | 高 | ログイン後のページは分析不可 |
| 遅延読み込み | 中 | lazy-load画像や無限スクロールコンテンツを取得できない |
| iframe内コンテンツ | 中 | 外部iframe内のコンテンツは取得不可 |

**推奨対策**:
- ユーザーに「SPA/CSRサイトは分析精度が低下する可能性がある」旨を明示する
- 将来的にヘッドレスブラウザ（Puppeteer/Playwright）対応を検討
- 外部サービス（Browserless、Bright Data等）をオプションとして統合を検討

### 1.3 localStorageの容量制限（5MB）

**結論: テキストベースの分析結果のみなら20〜30回分は保存可能。スクリーンショットを含むと不足する**

| データ種別 | 推定サイズ/回 | 10回分 | 30回分 |
|------------|--------------|--------|--------|
| 分析結果テキスト（16ペルソナ） | 100〜200KB | 1〜2MB | 3〜6MB |
| 分析過程（思考プロセス） | 50〜150KB | 0.5〜1.5MB | 1.5〜4.5MB |
| メタデータ・スコア | 5〜10KB | 50〜100KB | 150〜300KB |
| スクリーンショット（Base64） | 200〜500KB/枚 | 2〜5MB | 6〜15MB |
| **合計（テキストのみ）** | **155〜360KB** | **1.5〜3.6MB** | **4.6〜10.8MB** |
| **合計（スクリーンショット含む）** | **355〜860KB** | **3.5〜8.6MB** | **超過** |

**推奨対策**:
- MVP段階ではスクリーンショットをlocalStorageに保存しない（表示のみ・都度取得）
- 保存件数の上限を設定（例: 最新20件）し、古いものを自動削除（FIFO）
- 分析過程（思考プロセス）は要約のみ保存し、詳細は再取得可能にする
- データ圧縮の検討（LZ-String等でlocalStorageに圧縮保存）
- 将来的にIndexedDB（容量制限が緩い: 50MB〜）への移行パスを確保

### 1.4 Base64での共有URLの実装

**結論: 非現実的。分析結果のデータ量がURLの長さ制限を大幅に超過する**

| ブラウザ | URL最大長 | 分析結果推定サイズ | 判定 |
|----------|----------|-------------------|------|
| Chrome | 約2MB | 100〜300KB (Base64後: 133〜400KB) | 技術的には可能 |
| Safari | 約80KB | 同上 | 超過する可能性あり |
| IE/Edge Legacy | 2,083文字 | 同上 | 完全に不可能 |
| サーバー制限 | 8KB〜16KB (一般的) | 同上 | 超過 |

**問題点**:
- Webサーバー（Nginx/Apache）のデフォルトURL長制限は8KB〜16KB
- Vercelのリクエストヘッダーサイズ制限もある
- URLが極端に長いと共有自体が困難（メール、チャット等でトリムされる）
- SEO/アナリティクスにも悪影響

**推奨対策**:
- MVP段階からVercel KV Free Tier（256MB、30K リクエスト/月）を使用
- 分析結果にUUID（短い共有ID）を付与し、`/share/:shareId`でアクセス
- 代替案: Supabase Free Tier（500MB PostgreSQL）での永続化
- Base64方式は「スコアサマリーのみ共有」のような極めて限定的なケースに限定

---

## 2. API設計の提案

### 2.1 エンドポイント設計

```
POST   /api/analyze              # 分析ジョブの開始（スクレイピング実行）
GET    /api/analyze/:id/stream   # SSEでペルソナ分析結果をストリーミング
GET    /api/analyze/:id          # 完了済み分析結果の取得
POST   /api/analyze/:id/persona  # 個別ペルソナの分析実行（クライアントオーケストレーション用）

GET    /api/personas             # ペルソナ一覧取得
POST   /api/personas             # カスタムペルソナ作成
PUT    /api/personas/:id         # ペルソナ更新
DELETE /api/personas/:id         # ペルソナ削除

POST   /api/export/pdf           # PDF生成
POST   /api/export/json          # JSON生成

POST   /api/share                # 共有URL生成
GET    /api/share/:shareId       # 共有結果取得
```

### 2.2 推奨アーキテクチャ: クライアントサイドオーケストレーション

Vercel Free Tierの10秒タイムアウト制限を回避するため、**クライアントサイドオーケストレーション**を推奨する。

```
[ブラウザ]
  │
  ├─ POST /api/scrape ──→ URLスクレイピング（10秒以内で完了可能）
  │    └─ レスポンス: { scrapedData, metadata }
  │
  ├─ POST /api/analyze/persona ──→ ペルソナ1の分析（Gemini API呼び出し）
  ├─ POST /api/analyze/persona ──→ ペルソナ2の分析（並列、p-limit制御）
  ├─ POST /api/analyze/persona ──→ ペルソナ3の分析
  │   ... （同時実行数を3〜5に制限）
  │
  └─ 全ペルソナ完了 → 結果を統合・表示・保存
```

**メリット**:
- 各API呼び出しが10秒以内に収まる（1ペルソナの分析は通常3〜8秒）
- Vercel Free Tierの制限内で動作可能
- ペルソナごとに完了次第すぐにUIに表示できる
- 部分的な失敗の際に他のペルソナの結果は保持できる

**デメリット**:
- Gemini APIキーをクライアントに公開できないため、各ペルソナの分析もAPI Route経由にする必要がある
- クライアントサイドの並列制御ロジックが必要

### 2.3 Streaming API の実装方式

**推奨: SSE (Server-Sent Events)**

| 項目 | SSE | WebSocket |
|------|-----|-----------|
| 通信方向 | サーバー→クライアント（単方向） | 双方向 |
| プロトコル | HTTP | 独自プロトコル |
| 自動再接続 | ブラウザ組み込み | 手動実装が必要 |
| Vercel対応 | Edge Runtimeで対応可能 | 対応制限あり |
| 実装複雑度 | 低 | 高 |
| 本ユースケース | 分析進捗の送信のみ → 最適 | 不要な双方向通信 |

**注意**: Vercel Serverless FunctionsでのSSEは10秒制限の影響を受ける。**Edge Runtime**を使用するか、前述のクライアントサイドオーケストレーションを採用すること。

クライアントサイドオーケストレーションの場合、SSEは不要になり、各ペルソナのAPI呼び出し完了をPromiseで管理する方がシンプルになる。

### 2.4 レート制限の考慮

| レベル | 制限 | 実装方式 |
|--------|------|----------|
| Gemini API | 15 RPM | サーバーサイドでグローバルカウンター管理 |
| ユーザー（IP） | 1分に1分析 | API Route内でレート制限チェック |
| ユーザー（日次） | 10分析/日 | localStorageまたはVercel KVで管理 |

**実装推奨**: `upstash/ratelimit`（Vercel KV連携、無料枠あり）またはインメモリカウンター（スケールしないが無料）

---

## 3. データフロー設計

### 3.1 全体フロー

```
[ユーザー入力]
    │
    ▼
[URL検証] ─── 不正URL → エラー表示
    │
    ▼
[スクレイピング API]
    ├── HTMLフェッチ（fetch）
    ├── HTML解析（cheerio）
    ├── メタデータ抽出
    ├── 構造化データ抽出
    └── パフォーマンスデータ取得（※後述の制約あり）
    │
    ▼
[分析コンテキスト生成]
    │ スクレイピング結果をAI向けプロンプトに整形
    │
    ▼
[ペルソナ別分析（並列・制限付き）]
    ├── ペルソナ1: Gemini API呼び出し → 結果返却
    ├── ペルソナ2: Gemini API呼び出し → 結果返却
    ├── ... （p-limit: 最大同時3〜5）
    └── ペルソナN: Gemini API呼び出し → 結果返却
    │
    ▼
[結果表示・保存]
    ├── UIにペルソナごとの結果を逐次表示
    ├── 総合スコア算出
    └── localStorageに保存
```

### 3.2 並列実行の制御方式

```typescript
import pLimit from 'p-limit';

const limit = pLimit(3); // 同時実行数を3に制限

const analyzeWithAllPersonas = async (scrapedData: ScrapedData, personas: Persona[]) => {
  const promises = personas.map(persona =>
    limit(async () => {
      // UIの状態更新: 「分析中」
      updatePersonaStatus(persona.id, 'analyzing');

      try {
        const result = await fetch('/api/analyze/persona', {
          method: 'POST',
          body: JSON.stringify({ scrapedData, persona }),
        });
        const data = await result.json();

        // UIの状態更新: 「完了」+ 結果表示
        updatePersonaResult(persona.id, data);
        return data;
      } catch (error) {
        // UIの状態更新: 「エラー」
        updatePersonaStatus(persona.id, 'error');
        return { persona: persona.id, error: error.message };
      }
    })
  );

  return Promise.allSettled(promises);
};
```

### 3.3 エラーハンドリング戦略

| エラー種別 | 検出方法 | 対応 |
|------------|----------|------|
| URL不正 | バリデーション（zod等） | 入力画面でエラー表示 |
| スクレイピング失敗 | fetchのHTTPステータス/タイムアウト | ユーザーに理由を表示、リトライ提案 |
| robots.txt拒否 | robots-parser等で事前チェック | ユーザーに通知、分析を中止 |
| Gemini APIレート制限 | 429レスポンス | 指数バックオフで自動リトライ（最大3回） |
| Gemini API障害 | 5xxレスポンス | エラー表示、後日リトライを提案 |
| 部分的ペルソナ失敗 | Promise.allSettled | 成功したペルソナの結果は表示、失敗分は個別リトライ可能に |
| タイムアウト | AbortController | 30秒でタイムアウト、ユーザーに通知 |
| SSRF攻撃 | URL検証（プライベートIP除外） | リクエスト拒否 |

---

## 4. スケーラビリティの懸念点

### 4.1 Vercel Serverless Functions の制限

| 項目 | Free Tier | Pro Tier ($20/月) |
|------|-----------|-------------------|
| 実行時間 | **10秒** | 60秒 |
| メモリ | 1024MB | 3008MB |
| ペイロードサイズ | 4.5MB | 4.5MB |
| 同時実行数 | 制限あり | 制限緩和 |
| 帯域 | 100GB/月 | 1TB/月 |

**致命的な問題**: Free Tierの10秒制限では、1ペルソナのGemini API呼び出し（応答待ち含む）すら完了しない可能性がある。Gemini 2.0 Flashの応答時間は通常2〜10秒だが、長い分析の場合は10秒を超える。

**対策の優先順位**:
1. **Edge Runtime の採用**: Vercel Edge Functionsは30秒（CPU時間制限あり）
2. **レスポンスの早期返却**: ストリーミングレスポンスを使い、タイムアウトを回避
3. **Gemini APIのストリーミング**: `stream: true`オプションで最初のトークンを早く返す
4. **分析プロンプトの最適化**: ペルソナ分析の出力量を制限して応答時間を短縮

### 4.2 Gemini API 無料枠の制限

| 制限項目 | 数値 | 影響 |
|----------|------|------|
| RPM（リクエスト/分） | 15 | 16ペルソナ同時実行不可、バッチ必須 |
| RPD（リクエスト/日） | 1,500 | 約93回の分析/日（16ペルソナ前提） |
| TPM（トークン/分） | 100万 | 通常は問題なし |

**複数ユーザー同時利用時のシミュレーション**:
- 1ユーザーの分析: 16リクエスト × 約5秒/リクエスト（3並列）= 約27秒
- 2ユーザーが同時に分析開始: 32リクエスト/分 → 15 RPMを超過
- **結論**: 無料枠では同時に1ユーザーしか分析できない

**対策**:
- 分析キューを実装し、同時分析ユーザー数を1に制限
- ユーザーに推定待ち時間を表示
- 将来的にAPIキーのBYOK（Bring Your Own Key）オプションを提供

### 4.3 スクレイピングの信頼性

| リスク | 発生確率 | 影響度 | 対策 |
|--------|----------|--------|------|
| Cloudflare Bot検出 | 高 | ページ取得失敗 | User-Agent適切設定、フォールバック通知 |
| Vercel IP範囲のブロック | 中 | 特定サイトで失敗 | エラーメッセージで説明 |
| 大規模ページ（>5MB） | 中 | メモリ超過/遅延 | HTML取得サイズに上限設定（2MB等） |
| リダイレクトループ | 低 | タイムアウト | リダイレクト回数制限（最大5回） |

---

## 5. 抜け漏れている要件・技術的リスク

### 5.1 致命的な抜け漏れ

#### (A) スクリーンショット取得の実装手段が未定義

要件 F-001 に「スクリーンショット取得（デスクトップ/モバイル）」とあるが、技術スタックの `fetch + cheerio` ではスクリーンショットを取得できない。

**必要な追加技術**:
- Puppeteer / Playwright（ヘッドレスブラウザ）→ Vercel Serverlessでは実行困難
- 外部API: Google PageSpeed Insights API（無料・スクリーンショット取得可能）
- 外部API: Screenshotlayer、urlbox等（有料が多い）

**推奨**: Google PageSpeed Insights APIを使用する。無料で、Lighthouseスコア+スクリーンショットが同時に取得できる。

#### (B) Lighthouse/パフォーマンス指標の取得手段が未定義

要件 F-001 に「Lighthouse等のパフォーマンス指標取得」とあるが、Lighthouse CLIはVercel Serverlessでは実行できない（Chromeが必要）。

**推奨**: Google PageSpeed Insights API（`https://www.googleapis.com/pagespeedonline/v5/runPagespeed`）を使用する。無料枠でLighthouseスコアが取得可能。

#### (C) Vercel Free Tierの10秒タイムアウト

前述の通り、AI分析のAPI処理が10秒以内に完了しない可能性が高い。これは設計上の根本的な制約。

**推奨**: Edge Runtime + ストリーミングレスポンス、またはクライアントサイドオーケストレーションを採用。

### 5.2 セキュリティ面の抜け漏れ

#### (D) SSRF（Server-Side Request Forgery）対策

ユーザーが入力したURLをサーバーサイドでfetchするため、SSRF攻撃のリスクがある。

**必要な対策**:
- プライベートIPアドレス（`10.x.x.x`, `172.16.x.x`, `192.168.x.x`, `127.0.0.1`）への接続をブロック
- `localhost`、`0.0.0.0`への接続をブロック
- 内部サービスのメタデータエンドポイント（`169.254.169.254`等）への接続をブロック
- URL解決後のIPアドレスをチェック（DNS Rebinding対策）

#### (E) robots.txt / 利用規約の準拠

スクレイピング対象サイトのrobots.txtを確認する機能が要件に含まれていない。

**推奨**: robots.txtをチェックし、disallowされているパスの場合はユーザーに警告を表示。完全なブロックは不要だが、表示は必要。

#### (F) Gemini APIキーの管理

APIキーをどこに保存し、どのように保護するかが要件に明記されていない。

**推奨**: Vercelの環境変数として管理。クライアントサイドには絶対に公開しない。

### 5.3 UX面の抜け漏れ

#### (G) 分析失敗時のフォールバックUX

スクレイピングやAI分析が失敗した場合のユーザー体験が定義されていない。

**推奨**:
- 段階的なエラー表示（「このサイトはJavaScriptで描画されているため、一部の情報が取得できません」等）
- 部分的な結果の表示（成功したペルソナの結果は表示）
- リトライボタンの提供

#### (H) 分析のキャンセル機能

分析開始後にキャンセルする機能が要件にない。16ペルソナの分析は数分かかるため、キャンセル機能は必要。

#### (I) URL入力時のプレビュー/確認

入力されたURLが正しいか、アクセス可能かを分析開始前に確認するステップが有用。

### 5.4 データ設計の抜け漏れ

#### (J) 分析結果のスキーマ定義

分析結果のデータ構造が未定義。以下のスキーマを提案する:

```typescript
interface AnalysisResult {
  id: string;                    // UUID
  url: string;                   // 分析対象URL
  createdAt: string;             // 分析日時（ISO 8601）
  status: 'pending' | 'analyzing' | 'completed' | 'partial' | 'failed';
  scrapedData: {
    title: string;
    description: string;
    html: string;                // 圧縮HTML（サイズ制限あり）
    metadata: Record<string, string>;
    structuredData: object[];
    lighthouseScore?: LighthouseScore;
    screenshotUrl?: string;
  };
  personaResults: PersonaResult[];
  overallScore: number;          // 0-100
  categoryScores: Record<string, number>;
}

interface PersonaResult {
  personaId: string;
  personaName: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  score: number;                 // 0-100
  findings: Finding[];
  thinkingProcess?: string;      // 分析過程
  completedAt?: string;
  error?: string;
}

interface Finding {
  id: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  codeExample?: string;          // 改善コード例
}
```

#### (K) ペルソナ選択の仕組み

16ペルソナ全てを毎回実行するのか、ユーザーが選択できるのかが不明確。

**推奨**: デフォルトでは主要5〜8ペルソナを有効にし、ユーザーが追加/除外できるUIを提供する。これによりAPI呼び出し回数を削減し、レート制限への影響を緩和できる。

### 5.5 PDF生成の実装方式

要件 F-005 にPDFエクスポートがあるが、実装方式が未定義。

**選択肢**:
| 方式 | メリット | デメリット |
|------|----------|-----------|
| クライアントサイド（jsPDF + html2canvas） | サーバー負荷なし、無料 | レイアウト再現性が低い、大きなバンドルサイズ |
| クライアントサイド（react-pdf） | React親和性が高い | 複雑なレイアウトの実装が大変 |
| サーバーサイド（Puppeteer） | 高品質なPDF | Vercel Serverlessでは実行困難 |
| 外部API（DocRaptor等） | 高品質 | 有料 |

**推奨**: クライアントサイドで`@react-pdf/renderer`を使用する。サーバー負荷がなく、Vercel Free Tierの制限にも影響しない。

---

## 6. 総合的な設計推奨事項

### 6.1 アーキテクチャ推奨

```
[Next.js App Router]
├── app/
│   ├── page.tsx                    # ランディング（URL入力）
│   ├── analyze/[id]/page.tsx       # 分析結果
│   ├── personas/page.tsx           # ペルソナ管理
│   ├── history/page.tsx            # 履歴
│   └── share/[shareId]/page.tsx    # 共有閲覧
├── app/api/
│   ├── scrape/route.ts             # スクレイピング（Edge Runtime推奨）
│   ├── analyze/
│   │   └── persona/route.ts        # 1ペルソナの分析（Edge Runtime推奨）
│   ├── share/route.ts              # 共有URL生成/取得
│   └── export/
│       └── json/route.ts           # JSONエクスポート
└── lib/
    ├── gemini.ts                   # Gemini APIクライアント
    ├── scraper.ts                  # スクレイピングロジック
    ├── storage.ts                  # localStorage抽象化
    ├── rate-limiter.ts             # レート制限
    └── validators.ts              # URL検証・SSRF対策
```

### 6.2 優先度付きリスク一覧

| # | リスク | 重大度 | 対策状況 |
|---|--------|--------|----------|
| 1 | Vercel Free Tier 10秒タイムアウト | 致命的 | Edge Runtime + クライアントオーケストレーションで対応可能 |
| 2 | スクリーンショット/Lighthouse取得手段なし | 致命的 | PageSpeed Insights APIで代替可能 |
| 3 | SPA/CSRサイトの分析品質低下 | 高 | 警告表示で対応、将来的にヘッドレスブラウザ導入 |
| 4 | Gemini API レート制限（同時ユーザー） | 高 | 分析キュー + 並列数制限で緩和 |
| 5 | SSRF攻撃リスク | 高 | URL検証・プライベートIPブロックで対応必須 |
| 6 | Base64共有URLの非現実性 | 中 | Vercel KV または Supabaseで永続化 |
| 7 | localStorage容量不足 | 中 | 保存件数制限 + 圧縮で対応 |
| 8 | PDF生成の実装方式未定 | 中 | クライアントサイド生成で対応 |

### 6.3 MVP段階での推奨スコープ

実現可能性とコストを考慮し、MVPでは以下のスコープを推奨する:

**含める**:
- URL入力 → スクレイピング → AI分析 → 結果表示
- デフォルトペルソナ（最初は5〜8個に絞る）
- カスタムペルソナCRUD
- localStorageでの履歴保存（最新20件、テキストのみ）
- JSONエクスポート

**MVPから除外し、Phase 2以降に回す**:
- スクリーンショット取得（PageSpeed Insights APIの統合は工数がかかる）
- Lighthouseスコア取得（同上）
- PDFエクスポート
- 共有URL機能（永続化ストレージが必要）
- Before/Afterビジュアル比較
- 分析過程の詳細表示（サマリーのみ表示）

---

## 7. 補足: 技術スタックの妥当性

| 技術 | 評価 | コメント |
|------|------|---------|
| Next.js 15 (App Router) | 適切 | Vercelとの親和性、Edge Runtime対応 |
| TypeScript | 適切 | 型安全性、開発効率 |
| Tailwind CSS + shadcn/ui | 適切 | 高速開発、一貫したデザイン |
| Gemini 2.0 Flash | 適切 | コスト効率最高、品質も十分 |
| fetch + cheerio | 条件付き適切 | 静的サイトには有効、SPA未対応は明示必要 |
| localStorage | 条件付き適切 | MVP段階では十分、容量管理が必要 |
| Vercel Free Tier | 条件付き適切 | 10秒制限への設計対応が必須 |

**全体評価**: 技術スタック自体は無料運用の方針に沿っており妥当だが、**Vercelの10秒制限**と**スクリーンショット/Lighthouse取得手段の欠如**という2つの致命的な問題を設計段階で解決する必要がある。これらはEdge Runtime採用とPageSpeed Insights API統合で解決可能。
