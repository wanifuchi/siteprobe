// ペルソナ分析API: POST /api/analyze/persona

import { NextRequest, NextResponse } from 'next/server';
import { analyzeWithPersona } from '@/lib/gemini';
import type { PersonaAnalyzeRequest, PersonaAnalyzeResponse } from '@/types';

export const maxDuration = 60;

// analysisPointsの最大文字数（プロンプトインジェクション対策）
const MAX_ANALYSIS_POINTS_LENGTH = 500;

export async function POST(request: NextRequest): Promise<NextResponse<PersonaAnalyzeResponse>> {
  // リクエストボディのパース
  let body: PersonaAnalyzeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'リクエストボディが不正です' },
      { status: 400 }
    );
  }

  const { scrapedData, persona } = body;

  // バリデーション: scrapedData
  if (!scrapedData || !scrapedData.url || !scrapedData.title === undefined) {
    return NextResponse.json(
      { success: false, error: 'スクレイピングデータが不正です' },
      { status: 400 }
    );
  }

  // バリデーション: persona
  if (!persona || !persona.id || !persona.name || !persona.specialty) {
    return NextResponse.json(
      { success: false, error: 'ペルソナデータが不正です' },
      { status: 400 }
    );
  }

  // プロンプトインジェクション対策: analysisPointsの長さ制限
  if (persona.analysisPoints && persona.analysisPoints.length > MAX_ANALYSIS_POINTS_LENGTH) {
    return NextResponse.json(
      { success: false, error: `分析観点は${MAX_ANALYSIS_POINTS_LENGTH}文字以内にしてください` },
      { status: 400 }
    );
  }

  // Gemini API呼び出し
  try {
    const result = await analyzeWithPersona(scrapedData, persona);
    if (!result.success) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '分析に失敗しました';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
