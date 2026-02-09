'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getScoreLabel } from '@/data/default-personas';
import type { CategoryScore } from '@/types';

interface ScoreDashboardProps {
  overallScore: number;
  categoryScores: CategoryScore[];
}

export function ScoreDashboard({ overallScore, categoryScores }: ScoreDashboardProps) {
  const scoreLabel = getScoreLabel(overallScore);

  return (
    <div className="space-y-4">
      {/* 全体スコア */}
      <Card>
        <CardContent className="flex items-center gap-6 pt-6">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            {/* スコアリング */}
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/30"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={scoreLabel.color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(overallScore / 100) * 251.2} 251.2`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: scoreLabel.color }}>
                {overallScore}
              </span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold">総合スコア</p>
            <p className="text-sm" style={{ color: scoreLabel.color }}>
              {scoreLabel.label}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* カテゴリスコア */}
      {categoryScores.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">カテゴリ別スコア</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryScores.map((cs) => {
              const label = getScoreLabel(cs.score);
              return (
                <div key={cs.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{cs.label}</span>
                    <span className="font-medium" style={{ color: label.color }}>
                      {cs.score}点
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${cs.score}%`,
                        backgroundColor: cs.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
