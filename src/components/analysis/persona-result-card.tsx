'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { FindingCard } from './finding-card';
import { getScoreLabel, CATEGORY_CONFIG } from '@/data/default-personas';
import { useState } from 'react';
import type { PersonaResult } from '@/types';

interface PersonaResultCardProps {
  result: PersonaResult;
}

export function PersonaResultCard({ result }: PersonaResultCardProps) {
  const [showProcess, setShowProcess] = useState(false);

  // ローディング状態
  if (result.status === 'waiting' || result.status === 'analyzing') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {result.personaName}
            {result.status === 'analyzing' && (
              <Badge variant="secondary" className="animate-pulse">
                分析中...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // エラー状態
  if (result.status === 'error') {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {result.personaName}
            <Badge variant="destructive">エラー</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {result.error || '分析に失敗しました'}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 完了状態
  const scoreLabel = getScoreLabel(result.score);
  const catConfig = CATEGORY_CONFIG[result.personaCategory];
  const sortedFindings = [...result.findings].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{result.personaName}</CardTitle>
            {catConfig && (
              <Badge variant="outline" style={{ borderColor: catConfig.color, color: catConfig.color }}>
                {catConfig.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: scoreLabel.color }}>
              {result.score}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* サマリー */}
        <p className="text-sm leading-relaxed">{result.summary}</p>

        {/* 思考過程 */}
        {result.thinkingProcess && (
          <>
            <Separator />
            <button
              onClick={() => setShowProcess(!showProcess)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <Brain className="h-4 w-4" />
              <span>分析過程を{showProcess ? '閉じる' : '表示'}</span>
              {showProcess ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>
            {showProcess && (
              <div className="rounded-md bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
                {result.thinkingProcess}
              </div>
            )}
          </>
        )}

        {/* 指摘事項 */}
        {sortedFindings.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">
                指摘事項 ({sortedFindings.length}件)
              </h4>
              {sortedFindings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
