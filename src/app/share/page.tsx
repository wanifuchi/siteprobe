'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { decompressAnalysis, type ShareData } from '@/lib/share';
import { getScoreLabel, CATEGORY_CONFIG } from '@/data/default-personas';
import type { PersonaCategory } from '@/types';

const SEVERITY_STYLE: Record<string, { label: string; className: string }> = {
  high: { label: '高', className: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '中', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: '低', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export default function SharePage() {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#data=')) {
      setError(true);
      return;
    }
    const compressed = hash.slice(6); // '#data='.length
    const result = decompressAnalysis(compressed);
    if (!result) {
      setError(true);
      return;
    }
    setData(result);
  }, []);

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">共有データが無効です</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  const scoreLabel = getScoreLabel(data.score);

  // カテゴリ別にグループ化
  const grouped = new Map<string, typeof data.personas>();
  for (const p of data.personas) {
    const list = grouped.get(p.cat) ?? [];
    list.push(p);
    grouped.set(p.cat, list);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 共有バナー */}
      <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-center text-sm text-blue-700">
        この分析結果は共有リンクから表示されています（閲覧専用）
      </div>

      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">分析結果</h1>
        <p className="text-sm text-muted-foreground mt-1 truncate">{data.url}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(data.date).toLocaleString('ja-JP')}
        </p>
      </div>

      {/* スコア */}
      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 py-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: scoreLabel.color }}
          >
            {data.score}
          </div>
          <div>
            <p className="text-lg font-medium">総合スコア</p>
            <p className="text-sm" style={{ color: scoreLabel.color }}>
              {scoreLabel.label}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* カテゴリスコア */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <h2 className="text-sm font-medium mb-3">カテゴリ別スコア</h2>
          <div className="space-y-2">
            {data.categories.map((cs) => {
              const config = CATEGORY_CONFIG[cs.cat as PersonaCategory];
              return (
                <div key={cs.cat} className="flex items-center gap-3">
                  <span className="text-sm w-24">{cs.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${cs.score}%`,
                        backgroundColor: config?.color || '#6b7280',
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{cs.score}点</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ペルソナ別結果 */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([cat, personas]) => {
          const config = CATEGORY_CONFIG[cat as PersonaCategory];
          return (
            <div key={cat}>
              <h2
                className="text-sm font-medium mb-3"
                style={{ color: config?.color }}
              >
                {config?.label || cat}
              </h2>

              <div className="space-y-3">
                {personas.map((persona, i) => (
                  <Card key={i}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{persona.name}</h3>
                        <Badge variant="outline" className="font-bold">
                          {persona.score}点
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{persona.summary}</p>

                      {persona.findings.length > 0 && (
                        <div className="space-y-2">
                          {persona.findings.map((f, j) => {
                            const sev = SEVERITY_STYLE[f.sev] || SEVERITY_STYLE.medium;
                            return (
                              <div key={j} className="rounded-lg border p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className={`text-xs ${sev.className}`}>
                                    {sev.label}
                                  </Badge>
                                  <span className="text-sm font-medium">{f.title}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{f.desc}</p>
                                {f.rec && (
                                  <p className="text-xs mt-1 text-primary">💡 {f.rec}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
