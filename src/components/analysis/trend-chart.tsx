'use client';

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { useTrendStore } from '@/stores/trend-store';
import { CATEGORY_CONFIG } from '@/data/default-personas';
import type { UrlTrend, CategoryScore, PersonaCategory } from '@/types';

interface TrendChartProps {
  url: string;
}

export function TrendChart({ url }: TrendChartProps) {
  const trend = useTrendStore((s) => s.getTrend(url));
  const [showCategories, setShowCategories] = useState(false);

  if (!trend || trend.dataPoints.length === 0) return null;

  // データポイントが1件のみの場合
  if (trend.dataPoints.length === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            スコア推移
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            初回分析です。同じURLを再分析するとスコア推移が表示されます。
          </p>
        </CardContent>
      </Card>
    );
  }

  return <TrendChartContent trend={trend} showCategories={showCategories} onToggleCategories={() => setShowCategories(!showCategories)} />;
}

function TrendChartContent({
  trend,
  showCategories,
  onToggleCategories,
}: {
  trend: UrlTrend;
  showCategories: boolean;
  onToggleCategories: () => void;
}) {
  // チャートデータの整形
  const chartData = useMemo(() => {
    return trend.dataPoints.map((point) => {
      const categoryMap: Record<string, number> = {};
      for (const cs of point.categoryScores) {
        categoryMap[cs.category] = cs.score;
      }
      return {
        date: new Date(point.date).toLocaleDateString('ja-JP', {
          month: 'short',
          day: 'numeric',
        }),
        fullDate: new Date(point.date).toLocaleString('ja-JP'),
        overallScore: point.overallScore,
        ...categoryMap,
      };
    });
  }, [trend.dataPoints]);

  // 全データポイントに登場するカテゴリを収集
  const categories = useMemo(() => {
    const catSet = new Set<PersonaCategory>();
    for (const point of trend.dataPoints) {
      for (const cs of point.categoryScores) {
        catSet.add(cs.category);
      }
    }
    return Array.from(catSet);
  }, [trend.dataPoints]);

  // 前回比の計算
  const latestScore = trend.dataPoints[trend.dataPoints.length - 1].overallScore;
  const previousScore = trend.dataPoints[trend.dataPoints.length - 2].overallScore;
  const diff = latestScore - previousScore;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            スコア推移
            <span className="text-sm font-normal text-muted-foreground">
              ({trend.dataPoints.length}回分析)
            </span>
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* 前回比 */}
            <ScoreDiff diff={diff} />
            {/* カテゴリ表示トグル */}
            <button
              onClick={onToggleCategories}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCategories ? 'カテゴリ非表示' : 'カテゴリ表示'}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--background))',
              }}
              labelFormatter={(_, payload) => {
                if (payload?.[0]?.payload?.fullDate) {
                  return payload[0].payload.fullDate;
                }
                return '';
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="circle"
              iconSize={8}
            />
            {/* 全体スコア */}
            <Line
              type="monotone"
              dataKey="overallScore"
              name="全体スコア"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            {/* カテゴリ別スコア */}
            {showCategories &&
              categories.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                return (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={config?.label ?? cat}
                    stroke={config?.color ?? '#94a3b8'}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                );
              })}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ScoreDiff({ diff }: { diff: number }) {
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
        <TrendingUp className="h-4 w-4" />
        +{diff}
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-red-600 dark:text-red-400">
        <TrendingDown className="h-4 w-4" />
        {diff}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
      <Minus className="h-4 w-4" />
      ±0
    </span>
  );
}
