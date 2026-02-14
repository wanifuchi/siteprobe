// ペルソナチャットAPI: POST /api/chat/persona

import { NextRequest, NextResponse } from 'next/server';
import { chatWithPersona } from '@/lib/gemini';
import type { PersonaChatRequest, PersonaChatResponse } from '@/types';

export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_LENGTH = 20;

export async function POST(request: NextRequest): Promise<NextResponse<PersonaChatResponse>> {
  let body: PersonaChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'リクエストボディが不正です' },
      { status: 400 }
    );
  }

  const { persona, analysisContext, conversationHistory, message } = body;

  // バリデーション
  if (!persona?.name || !persona?.specialty) {
    return NextResponse.json(
      { success: false, error: 'ペルソナデータが不正です' },
      { status: 400 }
    );
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'メッセージが空です' },
      { status: 400 }
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { success: false, error: `メッセージは${MAX_MESSAGE_LENGTH}文字以内にしてください` },
      { status: 400 }
    );
  }

  if (!analysisContext?.url) {
    return NextResponse.json(
      { success: false, error: '分析コンテキストが不正です' },
      { status: 400 }
    );
  }

  // 会話履歴の制限
  const history = Array.isArray(conversationHistory)
    ? conversationHistory.slice(-MAX_HISTORY_LENGTH)
    : [];

  try {
    const result = await chatWithPersona(persona, analysisContext, history, message.trim());
    if (!result.success) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'チャットに失敗しました';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
