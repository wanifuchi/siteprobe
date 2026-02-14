// ペルソナAIアシストAPI: POST /api/assist/persona

import { NextRequest, NextResponse } from 'next/server';
import { generatePersonaSuggestion } from '@/lib/gemini';
import type { PersonaAssistRequest, PersonaAssistResponse } from '@/types';

export const maxDuration = 30;

const MAX_THEME_LENGTH = 200;

export async function POST(request: NextRequest): Promise<NextResponse<PersonaAssistResponse>> {
  let body: PersonaAssistRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'リクエストボディが不正です' },
      { status: 400 }
    );
  }

  const { theme } = body;

  if (!theme || typeof theme !== 'string' || !theme.trim()) {
    return NextResponse.json(
      { success: false, error: 'テーマを入力してください' },
      { status: 400 }
    );
  }

  if (theme.length > MAX_THEME_LENGTH) {
    return NextResponse.json(
      { success: false, error: `テーマは${MAX_THEME_LENGTH}文字以内で入力してください` },
      { status: 400 }
    );
  }

  try {
    const result = await generatePersonaSuggestion(theme.trim());
    if (!result.success) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'ペルソナ生成に失敗しました';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
