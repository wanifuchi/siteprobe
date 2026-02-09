'use client';

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface UrlInputFormProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
}

export function UrlInputForm({ onSubmit, isLoading }: UrlInputFormProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = url.trim();
    if (!trimmed) {
      setError('URLを入力してください');
      return;
    }

    // 簡易プロトコル補完
    let normalizedUrl = trimmed;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      normalizedUrl = `https://${trimmed}`;
    }

    // 簡易バリデーション
    try {
      new URL(normalizedUrl);
    } catch {
      setError('有効なURLを入力してください');
      return;
    }

    onSubmit(normalizedUrl);
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
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </form>
  );
}
