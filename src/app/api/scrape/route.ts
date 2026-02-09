// スクレイピングAPI: POST /api/scrape

import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/validators';
import { scrapeUrl } from '@/lib/scraper';
import { checkRateLimit } from '@/lib/rate-limiter';
import type { ScrapeResponse } from '@/types';

export const runtime = 'edge';

export async function POST(request: NextRequest): Promise<NextResponse<ScrapeResponse>> {
  // レート制限チェック
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: `リクエスト制限中です。${rateLimit.retryAfter}秒後に再試行してください` },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfter) },
      }
    );
  }

  // リクエストボディのパース
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'リクエストボディが不正です' },
      { status: 400 }
    );
  }

  const { url } = body;

  // URL検証
  if (!url || typeof url !== 'string') {
    return NextResponse.json(
      { success: false, error: 'URLが指定されていません' },
      { status: 400 }
    );
  }

  const validation = validateUrl(url);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 }
    );
  }

  // スクレイピング実行
  try {
    const data = await scrapeUrl(url);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'スクレイピングに失敗しました';
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 }
    );
  }
}
