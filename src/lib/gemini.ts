// Gemini APIクライアント

import { GoogleGenerativeAI, type Schema, SchemaType } from '@google/generative-ai';
import type { ScrapedData, Persona, PersonaAnalyzeResponse, Finding } from '@/types';

const MODEL_NAME = 'gemini-2.5-flash-lite';

// Gemini APIに渡すレスポンススキーマ（JSON構造を厳密に制御）
const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.INTEGER, description: '0-100の評価スコア' },
    summary: { type: SchemaType.STRING, description: '200文字以内の総合評価' },
    findings: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          severity: { type: SchemaType.STRING, format: 'enum', enum: ['high', 'medium', 'low'] },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          recommendation: { type: SchemaType.STRING },
          codeExample: { type: SchemaType.STRING, description: '改善コード例（任意）', nullable: true },
        },
        required: ['id', 'category', 'severity', 'title', 'description', 'recommendation'],
      },
    },
    thinkingProcess: { type: SchemaType.STRING, description: '分析の思考過程（400文字以内）' },
  },
  required: ['score', 'summary', 'findings', 'thinkingProcess'],
};

/**
 * Gemini APIを使用してペルソナ視点でサイトを分析する
 */
export async function analyzeWithPersona(
  scrapedData: ScrapedData,
  persona: Persona
): Promise<PersonaAnalyzeResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Gemini APIキーが設定されていません' };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  // システムプロンプト: ペルソナの役割設定
  const systemPrompt = buildSystemPrompt(persona);
  // ユーザープロンプト: スクレイピングデータ
  const userPrompt = buildUserPrompt(scrapedData);

  const MAX_RETRIES = 1;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: attempt === 0 ? 0.7 : 0.3, // リトライ時はtemperatureを下げる
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const response = result.response;
      const text = response.text();

      // JSONレスポンスをパース
      const parsed = parseJsonResponse(text);
      if (!parsed) {
        // 最後のリトライでも失敗した場合のみエラー
        if (attempt === MAX_RETRIES) {
          return { success: false, error: '分析結果のパースに失敗しました' };
        }
        continue; // リトライ
      }

      return {
        success: true,
        result: {
          score: clampScore(parsed.score),
          summary: String(parsed.summary || ''),
          findings: validateFindings(parsed.findings),
          thinkingProcess: String(parsed.thinkingProcess || ''),
        },
      };
    } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '不明なエラー';

    // レート制限エラーの判定
    if (message.includes('429') || message.includes('RATE_LIMIT') || message.includes('quota')) {
      return { success: false, error: 'APIレート制限に達しました。しばらくしてから再試行してください' };
    }

    // タイムアウト
    if (message.includes('timeout') || message.includes('DEADLINE_EXCEEDED')) {
      return { success: false, error: '分析がタイムアウトしました' };
    }

    return { success: false, error: `分析に失敗しました: ${message}` };
    }
  }

  return { success: false, error: '分析結果のパースに失敗しました（リトライ上限）' };
}

/**
 * ペルソナの役割・専門分野を反映したシステムプロンプトを構築
 */
function buildSystemPrompt(persona: Persona): string {
  return `あなたは「${persona.name}」として、Webサイトを専門的に分析するプロフェッショナルです。

【あなたの専門分野】
${persona.specialty}

【分析の観点】
${persona.analysisPoints}

【出力形式】
以下のJSON形式で回答してください。他のテキストは含めないでください。

{
  "score": <0から100の整数。サイトの評価スコア>,
  "summary": "<200文字以内の総合評価サマリー>",
  "findings": [
    {
      "id": "<ユニークID（例: f-1）>",
      "category": "<カテゴリ名>",
      "severity": "<high | medium | low>",
      "title": "<発見事項のタイトル>",
      "description": "<詳細な説明>",
      "recommendation": "<具体的な改善提案>",
      "codeExample": "<改善コード例（任意）>"
    }
  ],
  "thinkingProcess": "<分析の思考過程を400文字以内で説明>"
}

【スコア計算方法（厳守）】
100点を満点として、発見した問題に応じて減点してください。

減点ガイドライン:
- severity: high の問題1件につき → -15点
- severity: medium の問題1件につき → -8点
- severity: low の問題1件につき → -3点

計算手順:
1. まずfindingsを洗い出す（3〜8件）
2. 各findingのseverityを決める
3. 100 - (highの件数×15) - (mediumの件数×8) - (lowの件数×3) でスコアを算出
4. あなたの専門分野での重大度に応じて±5点の微調整は可能

スコアの目安:
- 85〜100: 優秀。この専門分野で大きな問題なし
- 65〜84: 良好だが改善余地あり
- 40〜64: 問題が多い。要改善
- 0〜39: 深刻な問題あり

注意: 全ペルソナが同じスコアになることはありえません。あなたの専門分野に特化して厳しく評価してください。

【ルール】
- findingsは3〜8件を目安に、重要度の高い順に列挙してください
- 改善提案は実行可能で具体的なものにしてください
- 日本語で回答してください`;
}

/**
 * スクレイピングデータを構造化してプロンプトに変換
 */
function buildUserPrompt(data: ScrapedData): string {
  // HTMLは分析に必要な情報量を確保しつつトークンを節約
  const truncatedHtml = data.html.slice(0, 15000);

  return `以下のWebサイトを分析してください。

【URL】${data.url}
【タイトル】${data.title}
【説明文】${data.description}

【見出し構造】
${data.headings.slice(0, 30).join('\n') || 'なし'}

【メタタグ】
${Object.entries(data.metaTags).slice(0, 20).map(([k, v]) => `${k}: ${v}`).join('\n') || 'なし'}

【リンク数】${data.links.length}件
【画像数】${data.images.length}件
${data.images.slice(0, 10).map(img => `- src: ${img.src}, alt: ${img.alt || '未設定'}`).join('\n')}

【構造化データ（JSON-LD）】
${data.structuredData.length > 0 ? JSON.stringify(data.structuredData, null, 2).slice(0, 3000) : 'なし'}

【外部スクリプト】
${data.scripts.slice(0, 15).join('\n') || 'なし'}

【パフォーマンスヒント】
- SSL: ${data.performanceHints.hasSsl ? 'あり' : 'なし'}
- レスポンシブメタタグ: ${data.performanceHints.hasResponsiveMeta ? 'あり' : 'なし'}
- 大きな画像: ${data.performanceHints.hasLargeImages ? 'あり' : 'なし'}
- ミニファイ済みアセット: ${data.performanceHints.hasMinifiedAssets ? 'あり' : 'なし'}

【HTML（先頭部分）】
${truncatedHtml}`;
}

/**
 * GeminiレスポンスからJSON部分を抽出してパース
 */
function parseJsonResponse(text: string): {
  score: number;
  summary: string;
  findings: Finding[];
  thinkingProcess: string;
} | null {
  // テキストのクリーンアップ
  let cleaned = text.trim();

  // マークダウンのコードブロックを除去 (```json ... ``` や ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // 1. 直接パースを試行
  try {
    return JSON.parse(cleaned);
  } catch {
    // 2. JSON部分を抽出して再試行（最も外側の { } を探す）
    let depth = 0;
    let start = -1;
    let end = -1;
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (cleaned[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (start !== -1 && end !== -1) {
      const jsonStr = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(jsonStr);
      } catch {
        // 3. 末尾カンマなどを修正して再試行
        const fixed = jsonStr
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        try {
          return JSON.parse(fixed);
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}

/**
 * スコアを0-100の範囲にクランプ
 */
function clampScore(score: unknown): number {
  const num = Number(score);
  if (isNaN(num)) return 50;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * findingsの配列を検証・正規化
 */
function validateFindings(findings: unknown): Finding[] {
  if (!Array.isArray(findings)) return [];

  return findings
    .filter((f): f is Record<string, unknown> => f !== null && typeof f === 'object')
    .slice(0, 10)
    .map((f, i) => ({
      id: String(f.id || `f-${i + 1}`),
      category: String(f.category || '一般'),
      severity: validateSeverity(f.severity),
      title: String(f.title || ''),
      description: String(f.description || ''),
      recommendation: String(f.recommendation || ''),
      codeExample: f.codeExample ? String(f.codeExample) : undefined,
    }));
}

/**
 * severityの値を検証
 */
function validateSeverity(value: unknown): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'medium';
}
