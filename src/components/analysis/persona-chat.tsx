'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useChatStore } from '@/stores/chat-store';
import { ChatMarkdown } from './chat-markdown';
import type { ChatMessage, Finding, PersonaChatRequest } from '@/types';

const EMPTY_MESSAGES: ChatMessage[] = [];

interface PersonaChatProps {
  analysisId: string;
  personaId: string;
  personaName: string;
  persona: { name: string; specialty: string; analysisPoints: string };
  analysisContext: { url: string; summary: string; score: number; findings: Finding[] };
}

const QUICK_QUESTIONS = [
  '具体的な改善手順を教えてください',
  '最も優先度が高い問題はどれですか？',
  'コード例を見せてください',
];

export function PersonaChat({
  analysisId,
  personaId,
  personaName,
  persona,
  analysisContext,
}: PersonaChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const key = `${analysisId}:${personaId}`;
  const messages = useChatStore((s) => s.chats[key]) ?? EMPTY_MESSAGES;
  const addMessage = useChatStore((s) => s.addMessage);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages.length, open, scrollToBottom]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // ユーザーメッセージを追加
    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    addMessage(analysisId, personaId, userMsg);
    setInput('');
    setIsLoading(true);

    try {
      const body: PersonaChatRequest = {
        persona,
        analysisContext,
        conversationHistory: messages,
        message: trimmed,
      };

      const res = await fetch('/api/chat/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || '応答に失敗しました');
        return;
      }

      const modelMsg: ChatMessage = {
        role: 'model',
        content: data.message,
        timestamp: new Date().toISOString(),
      };
      addMessage(analysisId, personaId, modelMsg);
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageCircle className="h-4 w-4" />
            {personaName}に質問する
            {messages.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                ({messages.length}件のメッセージ)
              </span>
            )}
          </div>
          <Chevron className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>

      {open && (
        <CardContent className="pt-0 space-y-3">
          {/* メッセージ一覧 */}
          {messages.length > 0 && (
            <ScrollArea className="h-[300px] rounded-md border p-3">
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {msg.role === 'model' ? (
                        <ChatMarkdown content={msg.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      回答を生成中...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}

          {/* 定型文ボタン（会話がまだない時） */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={isLoading}
                  onClick={() => {
                    sendMessage(q);
                  }}
                >
                  {q}
                </Button>
              ))}
            </div>
          )}

          {/* 入力エリア */}
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="質問を入力... (Enter で送信、Shift+Enter で改行)"
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
