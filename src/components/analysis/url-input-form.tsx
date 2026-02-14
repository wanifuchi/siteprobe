'use client';

import { useState } from 'react';
import { Search, Loader2, GitCompareArrows, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const MAX_COMPETITORS = 3;

interface UrlInputFormProps {
  onSubmit: (url: string, competitorUrl?: string, additionalCompetitorUrls?: string[]) => void;
  isLoading?: boolean;
}

export function UrlInputForm({ onSubmit, isLoading }: UrlInputFormProps) {
  const [url, setUrl] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([]);
  const [showCompetitor, setShowCompetitor] = useState(false);
  const [error, setError] = useState('');

  const normalizeUrl = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    let normalized = trimmed;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      normalized = `https://${trimmed}`;
    }

    try {
      new URL(normalized);
      return normalized;
    } catch {
      return null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = url.trim();
    if (!trimmed) {
      setError('URLを入力してください');
      return;
    }

    const normalizedUrl = normalizeUrl(trimmed);
    if (!normalizedUrl) {
      setError('有効なURLを入力してください');
      return;
    }

    // 競合URLのバリデーション
    const validCompetitors: string[] = [];
    if (showCompetitor) {
      for (let i = 0; i < competitorUrls.length; i++) {
        const raw = competitorUrls[i].trim();
        if (!raw) continue;
        const normalized = normalizeUrl(raw);
        if (!normalized) {
          setError(`競合サイト${i + 1}の有効なURLを入力してください`);
          return;
        }
        if (normalized === normalizedUrl) {
          setError(`競合サイト${i + 1}はメインサイトと異なるURLにしてください`);
          return;
        }
        if (validCompetitors.includes(normalized)) {
          setError(`競合サイト${i + 1}は他の競合サイトと異なるURLにしてください`);
          return;
        }
        validCompetitors.push(normalized);
      }
    }

    // 1社目 = competitorUrl, 2社目以降 = additionalCompetitorUrls
    const first = validCompetitors[0];
    const additional = validCompetitors.length > 1 ? validCompetitors.slice(1) : undefined;
    onSubmit(normalizedUrl, first, additional);
  };

  const addCompetitor = () => {
    if (competitorUrls.length < MAX_COMPETITORS) {
      setCompetitorUrls([...competitorUrls, '']);
    }
  };

  const removeCompetitor = (index: number) => {
    const next = competitorUrls.filter((_, i) => i !== index);
    if (next.length === 0) {
      setShowCompetitor(false);
    }
    setCompetitorUrls(next);
    if (error) setError('');
  };

  const updateCompetitor = (index: number, value: string) => {
    const next = [...competitorUrls];
    next[index] = value;
    setCompetitorUrls(next);
    if (error) setError('');
  };

  const handleShowCompetitor = () => {
    setShowCompetitor(true);
    setCompetitorUrls(['']);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError('');
            }}
            disabled={isLoading}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button type="submit" disabled={isLoading} size="lg" className="h-12 px-6">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              分析中...
            </>
          ) : (
            '分析開始'
          )}
        </Button>
      </div>

      {/* 競合比較トグル */}
      {!showCompetitor ? (
        <button
          type="button"
          onClick={handleShowCompetitor}
          disabled={isLoading}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto disabled:opacity-50"
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          + 競合サイトと比較
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          {competitorUrls.map((compUrl, index) => (
            <div key={index} className="flex gap-2 items-center">
              <div className="relative flex-1">
                <GitCompareArrows className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={`競合サイト${index + 1}のURL`}
                  value={compUrl}
                  onChange={(e) => updateCompetitor(index, e.target.value)}
                  disabled={isLoading}
                  className="pl-10 h-10 text-sm"
                />
              </div>
              {/* 分析レベルバッジ */}
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${
                  index === 0
                    ? 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400'
                    : 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400'
                }`}
              >
                {index === 0 ? '詳細' : '簡易'}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => removeCompetitor(index)}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* 競合追加ボタン */}
          {competitorUrls.length < MAX_COMPETITORS && (
            <button
              type="button"
              onClick={addCompetitor}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              競合サイトを追加（最大{MAX_COMPETITORS}社）
            </button>
          )}

          {/* 分析レベル説明 */}
          {competitorUrls.length > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              1社目は16ペルソナ詳細分析、2社目以降はカテゴリ別簡易分析
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </form>
  );
}
