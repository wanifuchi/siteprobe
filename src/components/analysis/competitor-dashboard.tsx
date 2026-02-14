'use client';

import { useMemo } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitCompareArrows, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { CategoryScore, CompetitorQuickResult } from '@/types';

interface CompetitorDashboardProps {
  mainUrl: string;
  mainOverallScore: number;
  mainCategoryScores: CategoryScore[];
  competitorUrl?: string;           // 1社目（詳細分析）
  competitorQuickResults?: CompetitorQuickResult[]; // 2-3社目（簡易分析）
}

// チャート用の色
const SITE_COLORS = [
  'hsl(var(--primary))',       // メインサイト
  '#3b82f6',                   // 競合1（青）
  '#f59e0b',                   // 競合2（オレンジ）
  '#10b981',                   // 競合3（緑）
];

// URL表示用にドメインを抽出
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function CompetitorDashboard({
  mainUrl,
  mainOverallScore,
  mainCategoryScores,
  competitorUrl,
  competitorQuickResults,
}: CompetitorDashboardProps) {
  // 表示対象のサイト一覧を構築
  const sites = useMemo(() => {
    const list: {
      url: string;
      label: string;
      overallScore: number;
      categoryScores: CategoryScore[];
      type: 'main' | 'detailed' | 'quick';
      strengths?: string[];
      weaknesses?: string[];
    }[] = [];

    // メインサイト
    list.push({
      url: mainUrl,
      label: extractDomain(mainUrl),
      overallScore: mainOverallScore,
      categoryScores: mainCategoryScores,
      type: 'main',
    });

    // 競合の簡易分析結果（1社目含む全競合）
    if (competitorQuickResults) {
      for (const result of competitorQuickResults) {
        // 1社目（詳細分析も実施済み）は 'detailed' タイプ
        const isDetailed = competitorUrl && extractDomain(result.url) === extractDomain(competitorUrl);
        list.push({
          url: result.url,
          label: extractDomain(result.url),
          overallScore: result.overallScore,
          categoryScores: result.categoryScores,
          type: isDetailed ? 'detailed' : 'quick',
          strengths: result.strengths,
          weaknesses: result.weaknesses,
        });
      }
    }

    return list;
  }, [mainUrl, mainOverallScore, mainCategoryScores, competitorUrl, competitorQuickResults]);

  // レーダーチャート用データを構築
  const radarData = useMemo(() => {
    const categories = mainCategoryScores.map((cs) => cs.label);

    return categories.map((label) => {
      const dataPoint: Record<string, string | number> = { category: label };
      for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        const cs = site.categoryScores.find((c) => c.label === label);
        dataPoint[`site${i}`] = cs?.score ?? 0;
      }
      return dataPoint;
    });
  }, [mainCategoryScores, sites]);

  if (sites.length <= 1) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4" />
          競合比較ダッシュボード
          <span className="text-sm font-normal text-muted-foreground">
            ({sites.length}サイト)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 全体スコア横並び */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sites.map((site, i) => (
            <div key={site.url} className="rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: SITE_COLORS[i] }}
                />
                <span className="text-xs font-medium truncate max-w-[120px]">
                  {site.label}
                </span>
              </div>
              <div className="text-2xl font-bold">{site.overallScore}</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                {site.type === 'main' && (
                  <Badge variant="default" className="text-xs">メイン</Badge>
                )}
                {site.type === 'detailed' && (
                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                    詳細分析
                  </Badge>
                )}
                {site.type === 'quick' && (
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                    簡易分析
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* レーダーチャート */}
        <div className="flex justify-center">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickCount={6}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--background))',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconType="circle"
                iconSize={8}
              />
              {sites.map((site, i) => (
                <Radar
                  key={site.url}
                  name={site.label}
                  dataKey={`site${i}`}
                  stroke={SITE_COLORS[i]}
                  fill={SITE_COLORS[i]}
                  fillOpacity={i === 0 ? 0.15 : 0.08}
                  strokeWidth={i === 0 ? 2 : 1.5}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* 競合の強み/弱み */}
        {sites.filter((s) => s.type !== 'main' && (s.strengths?.length || s.weaknesses?.length)).length > 0 && (
          <div className="space-y-4">
            {sites
              .filter((s) => s.type !== 'main')
              .map((site) => (
                <div key={site.url} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium">{site.label}</span>
                    {site.type === 'detailed' ? (
                      <Badge variant="outline" className="text-xs border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                        詳細分析
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                        簡易分析
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 強み */}
                    {site.strengths && site.strengths.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 mb-1.5">
                          <ThumbsUp className="h-3.5 w-3.5" />
                          強み
                        </div>
                        <ul className="space-y-1">
                          {site.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-green-500 mt-0.5 shrink-0">+</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* 弱み */}
                    {site.weaknesses && site.weaknesses.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 mb-1.5">
                          <ThumbsDown className="h-3.5 w-3.5" />
                          弱み
                        </div>
                        <ul className="space-y-1">
                          {site.weaknesses.map((w, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-red-500 mt-0.5 shrink-0">-</span>
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
