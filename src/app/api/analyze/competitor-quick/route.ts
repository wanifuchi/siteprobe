// 競合簡易分析API: POST /api/analyze/competitor-quick

import { NextRequest, NextResponse } from 'next/server';
import { analyzeCompetitorQuick } from '@/lib/gemini';
import type { CompetitorQuickRequest, CompetitorQuickResponse } from '@/types';

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<NextResponse<CompetitorQuickResponse>> {
  let body: CompetitorQuickRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'リクエストボディが不正です' },
      { status: 400 }
    );
  }

  const { scrapedData } = body;

  if (!scrapedData || !scrapedData.url || !scrapedData.html) {
    return NextResponse.json(
      { success: false, error: 'スクレイピングデータが不正です' },
      { status: 400 }
    );
  }

  try {
    const result = await analyzeCompetitorQuick(scrapedData);
    if (!result.success) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '簡易分析に失敗しました';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
