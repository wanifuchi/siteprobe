'use client';

import { CheckCircle2, Loader2, AlertCircle, Clock, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatElapsedTime } from '@/hooks/use-elapsed-time';
import type { PersonaResult, AnalysisStatus } from '@/types';

interface AnalysisProgressProps {
  status: AnalysisStatus;
  personaResults: PersonaResult[];
  elapsedMs: number;
  onCancel?: () => void;
}

const STATUS_ICON = {
  waiting: <Clock className="h-4 w-4 text-muted-foreground" />,
  analyzing: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
};

const STATUS_LABEL = {
  waiting: '待機中',
  analyzing: '分析中...',
  completed: '完了',
  error: 'エラー',
};

export function AnalysisProgress({
  status,
  personaResults,
  elapsedMs,
  onCancel,
}: AnalysisProgressProps) {
  const total = personaResults.length;
  const completed = personaResults.filter(
    (r) => r.status === 'completed' || r.status === 'error'
  ).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const analyzing = personaResults.find((r) => r.status === 'analyzing');

  if (status === 'idle') return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {status === 'preparing' && 'サイト情報を取得中...'}
            {status === 'analyzing' && '分析中...'}
            {status === 'completed' && '分析完了'}
            {status === 'error' && 'エラーが発生しました'}
            {status === 'cancelled' && 'キャンセルしました'}
          </CardTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatElapsedTime(elapsedMs)}</span>
            {(status === 'preparing' || status === 'analyzing') && onCancel && (
              <button
                onClick={onCancel}
                className="text-destructive hover:underline text-xs"
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 全体プログレスバー */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {analyzing
                ? `${analyzing.personaName} を分析中...`
                : status === 'preparing'
                  ? 'HTMLを取得しています...'
                  : `${completed}/${total} 完了`}
            </span>
            <span className="font-medium">{percent}%</span>
          </div>
          <Progress value={status === 'preparing' ? 5 : percent} className="h-2" />
        </div>

        {/* 個別ペルソナ進捗 */}
        {total > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {personaResults.map((r) => (
              <div
                key={r.personaId}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                {STATUS_ICON[r.status]}
                <span className="truncate flex-1">{r.personaName}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {r.status === 'completed' && `${r.score}点`}
                  {r.status !== 'completed' && STATUS_LABEL[r.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
