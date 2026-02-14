'use client';

import { useRouter } from 'next/navigation';
import { Trash2, ExternalLink, Clock, GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useHistoryStore } from '@/stores/history-store';
import { getScoreLabel, CATEGORY_CONFIG } from '@/data/default-personas';

export default function HistoryPage() {
  const router = useRouter();
  const history = useHistoryStore((s) => s.history);
  const deleteAnalysis = useHistoryStore((s) => s.deleteAnalysis);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">分析履歴</h1>
          <p className="text-sm text-muted-foreground mt-1">
            過去{history.length}件の分析結果
          </p>
        </div>
        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive gap-1"
            onClick={() => {
              clearHistory();
              toast.success('履歴を全て削除しました');
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            全削除
          </Button>
        )}
      </div>

      {/* 履歴一覧 */}
      {history.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">分析履歴がありません</p>
            <Button variant="link" size="sm" onClick={() => router.push('/')}>
              分析を開始する
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const scoreLabel = getScoreLabel(item.overallScore);
            return (
              <Card
                key={item.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => router.push(`/analyze/${item.id}`)}
              >
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  {/* スコア */}
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
                    style={{ backgroundColor: scoreLabel.color }}
                  >
                    {item.overallScore}
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.url}</p>
                    {item.competitorUrl && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <GitCompareArrows className="h-3 w-3 text-blue-500 shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">
                          vs {item.competitorUrl}
                          {item.competitorUrls && item.competitorUrls.length > 1 && (
                            <> 他{item.competitorUrls.length - 1}サイト</>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString('ja-JP')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.completedPersonaCount}/{item.personaCount} ペルソナ
                      </span>
                    </div>
                    {/* カテゴリスコア */}
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {item.categoryScores.map((cs) => {
                        const config = CATEGORY_CONFIG[cs.category];
                        return (
                          <Badge
                            key={cs.category}
                            variant="outline"
                            className="text-xs py-0"
                            style={{ borderColor: config?.color, color: config?.color }}
                          >
                            {cs.label} {cs.score}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* アクション */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(item.url, '_blank');
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnalysis(item.id);
                        toast.success('削除しました');
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
