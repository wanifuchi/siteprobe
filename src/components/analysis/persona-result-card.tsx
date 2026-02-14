'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ChevronDown, ChevronUp, Brain, RotateCw, GitCompareArrows, ThumbsUp, ThumbsDown, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FindingCard } from './finding-card';
import { PersonaChat } from './persona-chat';
import { getScoreLabel, CATEGORY_CONFIG } from '@/data/default-personas';
import { usePersonaStore } from '@/stores/persona-store';
import { useState } from 'react';
import type { PersonaResult, CompetitorComparison } from '@/types';

interface PersonaResultCardProps {
  result: PersonaResult;
  analysisId?: string;
  analysisUrl?: string;
  competitorUrl?: string;
  onRetry?: (personaId: string) => void;
}

export function PersonaResultCard({ result, analysisId, analysisUrl, competitorUrl, onRetry }: PersonaResultCardProps) {
  const [showProcess, setShowProcess] = useState(false);
  const personas = usePersonaStore((s) => s.personas);
  const personaData = personas.find((p) => p.id === result.personaId);

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
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {result.error || '分析に失敗しました'}
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onRetry(result.personaId)}
            >
              <RotateCw className="h-3.5 w-3.5" />
              再試行
            </Button>
          )}
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

        {/* 競合比較セクション */}
        {result.competitorComparison && (
          <>
            <Separator />
            <CompetitorComparisonSection comparison={result.competitorComparison} competitorUrl={competitorUrl} />
          </>
        )}

        {/* チャット */}
        {analysisId && (
          <>
            <Separator />
            <PersonaChat
              analysisId={analysisId}
              personaId={result.personaId}
              personaName={result.personaName}
              persona={{
                name: result.personaName,
                specialty: personaData?.specialty || '',
                analysisPoints: personaData?.analysisPoints || '',
              }}
              analysisContext={{
                url: analysisUrl || '',
                summary: result.summary,
                score: result.score,
                findings: result.findings,
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 競合比較結果の表示セクション
 */
function CompetitorComparisonSection({ comparison, competitorUrl }: { comparison: CompetitorComparison; competitorUrl?: string }) {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowComparison(!showComparison)}
        className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors w-full"
      >
        <GitCompareArrows className="h-4 w-4 text-blue-500" />
        <span>競合比較</span>
        {competitorUrl && (
          <span className="text-xs text-muted-foreground font-normal truncate max-w-[200px]">
            (vs {competitorUrl})
          </span>
        )}
        {showComparison ? (
          <ChevronUp className="h-4 w-4 ml-auto" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-auto" />
        )}
      </button>

      {showComparison && (
        <div className="space-y-4">
          {/* 総合比較評価 */}
          {comparison.overallAssessment && (
            <p className="text-sm leading-relaxed rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-blue-900 dark:text-blue-100">
              {comparison.overallAssessment}
            </p>
          )}

          {/* 2カラム: 自サイト vs 競合 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* メインサイトの強み */}
            <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                <ThumbsUp className="h-3.5 w-3.5" />
                自サイトが優れている点
              </div>
              <ul className="space-y-1.5">
                {comparison.mainSiteAdvantages.map((item, i) => (
                  <li key={i} className="text-xs leading-relaxed text-green-800 dark:text-green-300">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 競合サイトの強み */}
            <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <ThumbsDown className="h-3.5 w-3.5" />
                競合が優れている点
              </div>
              <ul className="space-y-1.5">
                {comparison.competitorAdvantages.map((item, i) => (
                  <li key={i} className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 改善提案 */}
          {comparison.suggestions.length > 0 && (
            <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                <Lightbulb className="h-3.5 w-3.5" />
                競合から学べる改善案
              </div>
              <ul className="space-y-1.5">
                {comparison.suggestions.map((item, i) => (
                  <li key={i} className="text-xs leading-relaxed text-blue-800 dark:text-blue-300">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
