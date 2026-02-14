// Gemini APIクライアント

import { GoogleGenerativeAI, type Schema, SchemaType } from '@google/generative-ai';
import type { ScrapedData, Persona, PersonaAnalyzeResponse, PersonaChatResponse, PersonaAssistResponse, ChatMessage, Finding, CompetitorComparison, PersonaCategory, CompetitorQuickResponse, CompetitorQuickResult, CategoryScore } from '@/types';

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
          temperature: attempt === 0 ? 0.5 : 0.2, // 安定化のため低めに設定
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
  // 評価フレームワークセクション
  const frameworkSection = persona.evaluationFramework
    ? `\n【評価フレームワーク】\n${persona.evaluationFramework}\nこのフレームワークに基づいて体系的に評価してください。`
    : '';

  // ペルソナ固有スコア基準セクション
  const scoringSection = persona.scoringCriteria
    ? `\n【ペルソナ固有スコア基準（厳守）】\n${persona.scoringCriteria}`
    : '';

  // 評価対象外セクション
  const exclusionSection = persona.exclusions
    ? `\n【評価対象外（他の専門家が担当）】\n${persona.exclusions}\n上記の領域には言及しないでください。あなたの専門分野に集中してください。`
    : '';

  return `あなたは「${persona.name}」です。${persona.specialty}の専門家として、Webサイトを分析するプロフェッショナルです。

【あなただけの分析視点】
他の15名の専門家はあなたとは異なる視点で同じサイトを分析しています。あなたは「${persona.specialty}」の観点に特化して、他の専門家には見つけられない専門的な指摘をしてください。

【分析の観点】
${persona.analysisPoints}
${frameworkSection}${exclusionSection}

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
${scoringSection}

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
 * HTMLから<head>セクションを優先的に抽出
 */
function extractHeadSection(html: string): string {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return '';
  // head内のscriptとstyleを除去してトークン効率化
  return headMatch[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .trim()
    .slice(0, 3000);
}

/**
 * HTMLの<body>からscript/styleタグを除去して本文コンテンツを抽出
 */
function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : html;
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
    .slice(0, 12000);
}

/**
 * スクレイピングデータを構造化してプロンプトに変換
 */
function buildUserPrompt(data: ScrapedData): string {
  // head セクションを優先的に抽出
  const headContent = extractHeadSection(data.html);
  // body コンテンツをクリーンに抽出
  const bodyContent = extractBodyContent(data.html);

  // 画像の統計情報
  const totalImages = data.images.length;
  const imagesWithoutAlt = data.images.filter(img => !img.alt || img.alt.trim() === '').length;

  // CSSクラス情報（取得済みだが未使用だったものを活用）
  const cssClassInfo = data.cssClasses.length > 0
    ? data.cssClasses.slice(0, 30).join(', ')
    : 'なし';

  return `以下のWebサイトを分析してください。

【URL】${data.url}
【タイトル】${data.title}
【説明文】${data.description}

【見出し構造】
${data.headings.slice(0, 30).join('\n') || 'なし'}

【メタタグ】
${Object.entries(data.metaTags).slice(0, 20).map(([k, v]) => `${k}: ${v}`).join('\n') || 'なし'}

【リンク数】${data.links.length}件
【画像】合計${totalImages}件（alt未設定: ${imagesWithoutAlt}件）
${data.images.slice(0, 10).map(img => `- src: ${img.src}, alt: ${img.alt || '未設定'}`).join('\n')}

【構造化データ（JSON-LD）】
${data.structuredData.length > 0 ? JSON.stringify(data.structuredData, null, 2).slice(0, 3000) : 'なし'}

【外部スクリプト】（合計${data.scripts.length}件）
${data.scripts.slice(0, 15).join('\n') || 'なし'}

【使用CSSクラス（主要）】
${cssClassInfo}

【パフォーマンスヒント】
- SSL: ${data.performanceHints.hasSsl ? 'あり' : 'なし'}
- レスポンシブメタタグ: ${data.performanceHints.hasResponsiveMeta ? 'あり' : 'なし'}
- 大きな画像: ${data.performanceHints.hasLargeImages ? 'あり' : 'なし'}
- ミニファイ済みアセット: ${data.performanceHints.hasMinifiedAssets ? 'あり' : 'なし'}

【<head>セクション】
${headContent || 'なし'}

【本文HTML（script/style除去済み）】
${bodyContent}`;
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
 * ペルソナとチャットする（マルチターン会話）
 */
export async function chatWithPersona(
  persona: { name: string; specialty: string; analysisPoints: string },
  analysisContext: { url: string; summary: string; score: number; findings: Finding[] },
  conversationHistory: ChatMessage[],
  userMessage: string
): Promise<PersonaChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Gemini APIキーが設定されていません' };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  // コンテキスト: ペルソナ設定 + 分析結果要約
  const contextPrompt = buildChatContext(persona, analysisContext);

  // 会話履歴を Gemini contents 形式に変換（最新10往復に制限）
  const recentHistory = conversationHistory.slice(-20);
  const contents = [
    { role: 'user' as const, parts: [{ text: contextPrompt }] },
    { role: 'model' as const, parts: [{ text: `はい、${persona.name}として回答いたします。分析結果を踏まえてご質問にお答えします。` }] },
    ...recentHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    })),
    { role: 'user' as const, parts: [{ text: userMessage }] },
  ];

  try {
    const result = await model.generateContent({
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      },
    });

    const response = result.response;
    const text = response.text();

    return { success: true, message: text };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '不明なエラー';

    if (message.includes('429') || message.includes('RATE_LIMIT') || message.includes('quota')) {
      return { success: false, error: 'APIレート制限に達しました。しばらくしてからお試しください' };
    }
    if (message.includes('timeout') || message.includes('DEADLINE_EXCEEDED')) {
      return { success: false, error: '応答がタイムアウトしました' };
    }
    return { success: false, error: `応答に失敗しました: ${message}` };
  }
}

/**
 * チャット用のコンテキストプロンプトを構築
 */
function buildChatContext(
  persona: { name: string; specialty: string; analysisPoints: string },
  context: { url: string; summary: string; score: number; findings: Finding[] }
): string {
  const findingsSummary = context.findings
    .slice(0, 8)
    .map((f) => `- [${f.severity}] ${f.title}: ${f.description}`)
    .join('\n');

  return `あなたは「${persona.name}」として、ユーザーの質問に答える専門家です。

【あなたの専門分野】
${persona.specialty}

【分析の観点】
${persona.analysisPoints}

【先ほど分析したサイト】
URL: ${context.url}
スコア: ${context.score}/100
総合評価: ${context.summary}

【主な指摘事項】
${findingsSummary || 'なし'}

【ルール】
- 上記の分析結果を踏まえて、ユーザーの質問に具体的に回答してください
- 改善提案は実行可能で具体的なものにしてください
- コード例を示す場合は、Markdownのコードブロック（\`\`\`言語名）形式で記述してください
- コード例は要点を示す最小限にしてください
- 回答は800文字程度を目安に簡潔にまとめてください
- 日本語で回答してください`;
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

// ========== 競合比較機能 ==========

// 競合比較用のレスポンススキーマ
const COMPARISON_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.INTEGER, description: '0-100の評価スコア（メインサイト）' },
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
    competitorComparison: {
      type: SchemaType.OBJECT,
      properties: {
        mainSiteAdvantages: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'メインサイトが競合より優れている点（2-4件）',
        },
        competitorAdvantages: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: '競合サイトが優れている点（2-4件）',
        },
        suggestions: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: '競合から学べる改善提案（2-4件）',
        },
        overallAssessment: {
          type: SchemaType.STRING,
          description: '総合比較評価（100文字以内）',
        },
      },
      required: ['mainSiteAdvantages', 'competitorAdvantages', 'suggestions', 'overallAssessment'],
    },
  },
  required: ['score', 'summary', 'findings', 'thinkingProcess', 'competitorComparison'],
};

/**
 * 競合比較付きでペルソナ分析を行う
 */
export async function analyzeWithPersonaAndCompetitor(
  scrapedData: ScrapedData,
  persona: Persona,
  competitorData: ScrapedData
): Promise<PersonaAnalyzeResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Gemini APIキーが設定されていません' };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const systemPrompt = buildComparisonSystemPrompt(persona);
  const userPrompt = buildComparisonUserPrompt(scrapedData, competitorData);

  const MAX_RETRIES = 1;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: attempt === 0 ? 0.5 : 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: COMPARISON_RESPONSE_SCHEMA,
        },
      });

      const response = result.response;
      const text = response.text();

      const parsed = parseComparisonResponse(text);
      if (!parsed) {
        if (attempt === MAX_RETRIES) {
          return { success: false, error: '比較分析結果のパースに失敗しました' };
        }
        continue;
      }

      return {
        success: true,
        result: {
          score: clampScore(parsed.score),
          summary: String(parsed.summary || ''),
          findings: validateFindings(parsed.findings),
          thinkingProcess: String(parsed.thinkingProcess || ''),
          competitorComparison: validateCompetitorComparison(parsed.competitorComparison),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '不明なエラー';

      if (message.includes('429') || message.includes('RATE_LIMIT') || message.includes('quota')) {
        return { success: false, error: 'APIレート制限に達しました。しばらくしてから再試行してください' };
      }
      if (message.includes('timeout') || message.includes('DEADLINE_EXCEEDED')) {
        return { success: false, error: '比較分析がタイムアウトしました' };
      }
      return { success: false, error: `比較分析に失敗しました: ${message}` };
    }
  }

  return { success: false, error: '比較分析結果のパースに失敗しました（リトライ上限）' };
}

/**
 * 競合比較用のシステムプロンプト
 */
function buildComparisonSystemPrompt(persona: Persona): string {
  const frameworkSection = persona.evaluationFramework
    ? `\n【評価フレームワーク】\n${persona.evaluationFramework}\nこのフレームワークに基づいて体系的に評価してください。`
    : '';

  const scoringSection = persona.scoringCriteria
    ? `\n【ペルソナ固有スコア基準（厳守）】\n${persona.scoringCriteria}`
    : '';

  const exclusionSection = persona.exclusions
    ? `\n【評価対象外（他の専門家が担当）】\n${persona.exclusions}\n上記の領域には言及しないでください。あなたの専門分野に集中してください。`
    : '';

  return `あなたは「${persona.name}」です。${persona.specialty}の専門家として、2つのWebサイトを比較分析するプロフェッショナルです。

【あなただけの分析視点】
他の15名の専門家はあなたとは異なる視点で同じサイトを分析しています。あなたは「${persona.specialty}」の観点に特化して比較分析してください。

【分析の観点】
${persona.analysisPoints}
${frameworkSection}${exclusionSection}

【タスク】
メインサイトを分析し、競合サイトと比較してください。
- score/summary/findings/thinkingProcess: メインサイトの分析（従来通り）
- competitorComparison: メインサイトと競合サイトの比較結果

【出力形式】
以下のJSON形式で回答してください。

{
  "score": <メインサイトの0-100スコア>,
  "summary": "<メインサイトの200文字以内の総合評価>",
  "findings": [
    {
      "id": "<ユニークID>",
      "category": "<カテゴリ名>",
      "severity": "<high | medium | low>",
      "title": "<メインサイトの発見事項>",
      "description": "<詳細な説明>",
      "recommendation": "<具体的な改善提案>"
    }
  ],
  "thinkingProcess": "<分析の思考過程を400文字以内で>",
  "competitorComparison": {
    "mainSiteAdvantages": ["メインサイトが優れている点1", "..."],
    "competitorAdvantages": ["競合が優れている点1", "..."],
    "suggestions": ["競合から学べる改善提案1", "..."],
    "overallAssessment": "総合比較評価（100文字以内）"
  }
}

【スコア計算方法（厳守）】
100点を満点として、発見した問題に応じて減点してください。
${scoringSection}

減点ガイドライン:
- severity: high → -15点
- severity: medium → -8点
- severity: low → -3点

【ルール】
- findingsは3〜8件を目安に
- competitorComparison の各項目は2〜4件を目安に
- 改善提案は実行可能で具体的に
- 日本語で回答してください`;
}

/**
 * 競合比較用のユーザープロンプト（2サイト分のデータ）
 */
function buildComparisonUserPrompt(mainData: ScrapedData, competitorData: ScrapedData): string {
  const mainHead = extractHeadSection(mainData.html);
  const mainBody = extractBodyContent(mainData.html).slice(0, 8000);
  const compHead = extractHeadSection(competitorData.html);
  const compBody = extractBodyContent(competitorData.html).slice(0, 8000);

  const mainImagesWithoutAlt = mainData.images.filter(img => !img.alt || img.alt.trim() === '').length;
  const compImagesWithoutAlt = competitorData.images.filter(img => !img.alt || img.alt.trim() === '').length;

  return `以下の2つのWebサイトを比較分析してください。

===== メインサイト =====
【URL】${mainData.url}
【タイトル】${mainData.title}
【説明文】${mainData.description}
【見出し構造】
${mainData.headings.slice(0, 20).join('\n') || 'なし'}
【メタタグ】
${Object.entries(mainData.metaTags).slice(0, 15).map(([k, v]) => `${k}: ${v}`).join('\n') || 'なし'}
【リンク数】${mainData.links.length}件
【画像】合計${mainData.images.length}件（alt未設定: ${mainImagesWithoutAlt}件）
【構造化データ】${mainData.structuredData.length > 0 ? JSON.stringify(mainData.structuredData, null, 2).slice(0, 2000) : 'なし'}
【外部スクリプト】${mainData.scripts.length}件
【パフォーマンス】SSL:${mainData.performanceHints.hasSsl ? 'あり' : 'なし'} / レスポンシブ:${mainData.performanceHints.hasResponsiveMeta ? 'あり' : 'なし'}
【<head>】
${mainHead || 'なし'}
【本文HTML】
${mainBody}

===== 競合サイト =====
【URL】${competitorData.url}
【タイトル】${competitorData.title}
【説明文】${competitorData.description}
【見出し構造】
${competitorData.headings.slice(0, 20).join('\n') || 'なし'}
【メタタグ】
${Object.entries(competitorData.metaTags).slice(0, 15).map(([k, v]) => `${k}: ${v}`).join('\n') || 'なし'}
【リンク数】${competitorData.links.length}件
【画像】合計${competitorData.images.length}件（alt未設定: ${compImagesWithoutAlt}件）
【構造化データ】${competitorData.structuredData.length > 0 ? JSON.stringify(competitorData.structuredData, null, 2).slice(0, 2000) : 'なし'}
【外部スクリプト】${competitorData.scripts.length}件
【パフォーマンス】SSL:${competitorData.performanceHints.hasSsl ? 'あり' : 'なし'} / レスポンシブ:${competitorData.performanceHints.hasResponsiveMeta ? 'あり' : 'なし'}
【<head>】
${compHead || 'なし'}
【本文HTML】
${compBody}`;
}

/**
 * 比較分析レスポンスのパース
 */
function parseComparisonResponse(text: string): {
  score: number;
  summary: string;
  findings: Finding[];
  thinkingProcess: string;
  competitorComparison: unknown;
} | null {
  const base = parseJsonResponse(text);
  if (!base) return null;
  return {
    ...base,
    competitorComparison: (base as Record<string, unknown>).competitorComparison,
  };
}

/**
 * 競合比較データの検証
 */
function validateCompetitorComparison(data: unknown): CompetitorComparison | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const d = data as Record<string, unknown>;

  return {
    mainSiteAdvantages: Array.isArray(d.mainSiteAdvantages)
      ? d.mainSiteAdvantages.filter((s): s is string => typeof s === 'string').slice(0, 5)
      : [],
    competitorAdvantages: Array.isArray(d.competitorAdvantages)
      ? d.competitorAdvantages.filter((s): s is string => typeof s === 'string').slice(0, 5)
      : [],
    suggestions: Array.isArray(d.suggestions)
      ? d.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 5)
      : [],
    overallAssessment: typeof d.overallAssessment === 'string' ? d.overallAssessment : '',
  };
}

// ========== ペルソナAIアシスト ==========

const PERSONA_ASSIST_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING, description: 'ペルソナ名（20文字以内）' },
    specialty: { type: SchemaType.STRING, description: '専門分野（40文字以内）' },
    analysisPoints: { type: SchemaType.STRING, description: '分析観点（カンマ区切り、300文字以内）' },
    category: { type: SchemaType.STRING, format: 'enum', enum: ['marketing', 'design', 'technical', 'business', 'user'], description: 'カテゴリ' },
    evaluationFramework: { type: SchemaType.STRING, description: '評価フレームワーク名' },
    scoringCriteria: { type: SchemaType.STRING, description: 'スコア基準（4段階: 90-100 / 70-89 / 40-69 / 0-39）' },
    exclusions: { type: SchemaType.STRING, description: '評価対象外の領域' },
  },
  required: ['name', 'specialty', 'analysisPoints', 'category', 'evaluationFramework', 'scoringCriteria', 'exclusions'],
};

/**
 * テーマからペルソナ設定をAI生成する
 */
export async function generatePersonaSuggestion(theme: string): Promise<PersonaAssistResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Gemini APIキーが設定されていません' };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const prompt = `あなたはWebサイト分析の専門家チームのディレクターです。ユーザーが指定したテーマに基づいて、新しいWebサイト分析ペルソナを設計してください。

【参考例1: SEOスペシャリスト】
- name: "SEOスペシャリスト"
- specialty: "検索エンジン最適化・テクニカルSEO"
- analysisPoints: "title/descriptionメタタグの最適化、構造化データ（JSON-LD）の有効性、見出し階層（h1-h6）の正確さ、canonical/hreflang設定、内部リンク構造とクローラビリティ、サイトマップとrobots.txt"
- category: "marketing"
- evaluationFramework: "E-E-A-T + テクニカルSEOチェックリスト"
- scoringCriteria: "90-100: メタタグ完全+構造化データ有効+見出し階層正確+内部リンク最適 / 70-89: 基本SEO対応あるが構造化データや見出し階層に改善余地 / 40-69: 重要メタタグ欠落または見出し構造に問題 / 0-39: SEO基本対策が未実施"
- exclusions: "コンテンツ文章品質、ビジュアルデザイン、ページ読み込み速度の詳細、サーバー設定"

【参考例2: UIデザイナー】
- name: "UIデザイナー"
- specialty: "ビジュアルデザイン・レイアウト設計"
- analysisPoints: "ビジュアルヒエラルキーの明確さ、カラーパレットの一貫性とコントラスト比、タイポグラフィ（フォント選定・サイズ・行間）、余白・グリッドシステムの統一感、画像・アイコンの品質と統一感、ダークモード対応"
- category: "design"
- evaluationFramework: "ビジュアルデザイン原則（近接・整列・反復・コントラスト）+ WCAG 2.1コントラスト基準"
- scoringCriteria: "90-100: ビジュアル統一感が高い+コントラスト適切+タイポグラフィ最適 / 70-89: デザインは良いが一部不統一やコントラスト不足 / 40-69: デザインに一貫性がない / 0-39: ビジュアルデザインが破綻"
- exclusions: "SEO、コピーライティング品質、バックエンド実装、パフォーマンス最適化"

【指定テーマ】
${theme}

上記テーマに合った独自のWebサイト分析ペルソナを設計してください。
- name: 専門家としてのペルソナ名（20文字以内）
- specialty: 専門分野（40文字以内）
- analysisPoints: HTMLやメタデータから分析可能な具体的な観点をカンマ区切りで（300文字以内）
- category: marketing, design, technical, business, user のいずれか
- evaluationFramework: 評価に使用するフレームワーク名
- scoringCriteria: 90-100 / 70-89 / 40-69 / 0-39 の4段階で具体的な基準
- exclusions: このペルソナが評価しない領域（他の専門家に任せる領域）`;

  try {
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: PERSONA_ASSIST_SCHEMA,
      },
    });

    const text = result.response.text();
    const parsed = parseJsonResponse(text);

    if (!parsed) {
      return { success: false, error: 'ペルソナ生成結果のパースに失敗しました' };
    }

    const p = parsed as Record<string, unknown>;
    const validCategories = ['marketing', 'design', 'technical', 'business', 'user'];
    const category = validCategories.includes(String(p.category)) ? String(p.category) as PersonaCategory : 'user';

    return {
      success: true,
      persona: {
        name: String(p.name || '').slice(0, 30),
        specialty: String(p.specialty || '').slice(0, 50),
        analysisPoints: String(p.analysisPoints || '').slice(0, 500),
        category,
        evaluationFramework: String(p.evaluationFramework || '').slice(0, 100),
        scoringCriteria: String(p.scoringCriteria || '').slice(0, 300),
        exclusions: String(p.exclusions || '').slice(0, 200),
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '不明なエラー';

    if (message.includes('429') || message.includes('RATE_LIMIT') || message.includes('quota')) {
      return { success: false, error: 'APIレート制限に達しました。しばらくしてからお試しください' };
    }
    return { success: false, error: `ペルソナ生成に失敗しました: ${message}` };
  }
}

// ========== 競合簡易分析（機能2: 2-3社目用） ==========

const COMPETITOR_QUICK_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    overallScore: { type: SchemaType.INTEGER, description: '0-100の総合スコア' },
    categoryScores: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING, format: 'enum', enum: ['marketing', 'design', 'technical', 'business', 'user'] },
          score: { type: SchemaType.INTEGER, description: '0-100のスコア' },
        },
        required: ['category', 'score'],
      },
    },
    strengths: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'サイトの強み（2-3件）',
    },
    weaknesses: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'サイトの弱み（2-3件）',
    },
  },
  required: ['overallScore', 'categoryScores', 'strengths', 'weaknesses'],
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  marketing: { label: 'マーケティング', color: '#8b5cf6' },
  design: { label: 'デザイン・UX', color: '#f472b6' },
  technical: { label: '技術', color: '#6366f1' },
  business: { label: 'ビジネス', color: '#f59e0b' },
  user: { label: 'ユーザー視点', color: '#34d399' },
};

/**
 * 競合サイトの簡易スコア分析（1回のAPI callで5カテゴリスコア+強み/弱み）
 */
export async function analyzeCompetitorQuick(
  scrapedData: ScrapedData
): Promise<CompetitorQuickResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Gemini APIキーが設定されていません' };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const headContent = extractHeadSection(scrapedData.html);
  const bodyContent = extractBodyContent(scrapedData.html).slice(0, 8000);
  const imagesWithoutAlt = scrapedData.images.filter(img => !img.alt || img.alt.trim() === '').length;

  const prompt = `あなたはWebサイト分析の専門家チームのリーダーです。以下のWebサイトを5つのカテゴリで簡易評価してください。

【URL】${scrapedData.url}
【タイトル】${scrapedData.title}
【説明文】${scrapedData.description}
【見出し構造】
${scrapedData.headings.slice(0, 20).join('\n') || 'なし'}
【メタタグ】
${Object.entries(scrapedData.metaTags).slice(0, 15).map(([k, v]) => `${k}: ${v}`).join('\n') || 'なし'}
【リンク数】${scrapedData.links.length}件
【画像】合計${scrapedData.images.length}件（alt未設定: ${imagesWithoutAlt}件）
【構造化データ】${scrapedData.structuredData.length > 0 ? JSON.stringify(scrapedData.structuredData, null, 2).slice(0, 2000) : 'なし'}
【外部スクリプト】${scrapedData.scripts.length}件
【パフォーマンス】SSL:${scrapedData.performanceHints.hasSsl ? 'あり' : 'なし'} / レスポンシブ:${scrapedData.performanceHints.hasResponsiveMeta ? 'あり' : 'なし'}
【<head>】
${headContent || 'なし'}
【本文HTML】
${bodyContent}

【評価カテゴリ】
1. marketing: マーケティング（SEO, OGP, ファネル設計, コンテンツ戦略）
2. design: デザイン・UX（ビジュアル品質, アクセシビリティ, モバイル対応, ユーザビリティ）
3. technical: 技術（パフォーマンス, セキュリティ, コード品質）
4. business: ビジネス（ブランディング, コンバージョン, 法的準拠）
5. user: ユーザー視点（第一印象, 業界標準準拠）

【スコア計算】
各カテゴリ0-100点で評価。100点満点から問題に応じて減点。
overallScoreは5カテゴリの加重平均。

【出力】
- overallScore: 総合スコア
- categoryScores: 5カテゴリ各スコア
- strengths: このサイトの強み（2-3件、各30文字以内）
- weaknesses: このサイトの弱み（2-3件、各30文字以内）

日本語で回答してください。`;

  try {
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: COMPETITOR_QUICK_SCHEMA,
      },
    });

    const text = result.response.text();
    const parsed = parseJsonResponse(text);

    if (!parsed) {
      return { success: false, error: '簡易分析結果のパースに失敗しました' };
    }

    const p = parsed as Record<string, unknown>;

    // カテゴリスコアの検証・正規化
    const validCategories = ['marketing', 'design', 'technical', 'business', 'user'];
    const rawCategoryScores = Array.isArray(p.categoryScores) ? p.categoryScores : [];
    const categoryScores: CategoryScore[] = validCategories.map((cat) => {
      const found = rawCategoryScores.find(
        (cs: Record<string, unknown>) => cs.category === cat
      );
      const info = CATEGORY_LABELS[cat];
      return {
        category: cat as PersonaCategory,
        label: info?.label ?? cat,
        score: found ? clampScore(found.score) : 50,
        color: info?.color ?? '#94a3b8',
      };
    });

    const quickResult: CompetitorQuickResult = {
      url: scrapedData.url,
      title: scrapedData.title,
      categoryScores,
      overallScore: clampScore(p.overallScore),
      strengths: Array.isArray(p.strengths)
        ? p.strengths.filter((s): s is string => typeof s === 'string').slice(0, 4)
        : [],
      weaknesses: Array.isArray(p.weaknesses)
        ? p.weaknesses.filter((s): s is string => typeof s === 'string').slice(0, 4)
        : [],
    };

    return { success: true, result: quickResult };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '不明なエラー';

    if (message.includes('429') || message.includes('RATE_LIMIT') || message.includes('quota')) {
      return { success: false, error: 'APIレート制限に達しました。しばらくしてから再試行してください' };
    }
    if (message.includes('timeout') || message.includes('DEADLINE_EXCEEDED')) {
      return { success: false, error: '簡易分析がタイムアウトしました' };
    }
    return { success: false, error: `簡易分析に失敗しました: ${message}` };
  }
}
