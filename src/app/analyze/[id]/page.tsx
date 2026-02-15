'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, Share2, FileText, GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { compressAnalysis } from '@/lib/share';
import { generateMarkdownReport, downloadTextFile } from '@/lib/export-text';
import { AnalysisProgress } from '@/components/analysis/analysis-progress';
import { PersonaSidebar } from '@/components/analysis/persona-sidebar';
import { PersonaResultCard } from '@/components/analysis/persona-result-card';
import { ScoreDashboard } from '@/components/analysis/score-dashboard';
import { PrioritySummary } from '@/components/analysis/priority-summary';
import { RoadmapView } from '@/components/analysis/roadmap-view';
import { TrendChart } from '@/components/analysis/trend-chart';
import { CompetitorDashboard } from '@/components/analysis/competitor-dashboard';
import { useAnalysisStore } from '@/stores/analysis-store';
import { useHistoryStore } from '@/stores/history-store';
import { useAnalysis } from '@/hooks/use-analysis';
import { useElapsedTime } from '@/hooks/use-elapsed-time';
import type { AnalysisResult } from '@/types';

export default function AnalyzePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const currentAnalysis = useAnalysisStore((s) => s.currentAnalysis);
  const status = useAnalysisStore((s) => s.status);
  const getAnalysisDetail = useHistoryStore((s) => s.getAnalysisDetail);
  const { cancelAnalysis, retryPersona } = useAnalysis();
  const { elapsedMs, start, stop } = useElapsedTime();

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // 分析データの解決（current → ストア、それ以外 → 履歴）
  useEffect(() => {
    if (id === 'current') {
      setAnalysis(currentAnalysis);
    } else {
      const detail = getAnalysisDetail(id);
      if (detail) {
        setAnalysis(detail);
      } else {
        router.push('/');
      }
    }
  }, [id, currentAnalysis, getAnalysisDetail, router]);

  // 経過時間タイマー
  useEffect(() => {
    if (id === 'current' && (status === 'preparing' || status === 'analyzing')) {
      start();
    } else {
      stop();
    }
  }, [id, status, start, stop]);

  // 最初に完了したペルソナを自動選択
  useEffect(() => {
    if (!selectedPersonaId && analysis?.personaResults) {
      const first = analysis.personaResults.find((r) => r.status === 'completed');
      if (first) {
        setSelectedPersonaId(first.personaId);
      }
    }
  }, [analysis?.personaResults, selectedPersonaId]);

  if (!analysis) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">分析データが見つかりません</p>
      </div>
    );
  }

  const selectedResult = analysis.personaResults.find(
    (r) => r.personaId === selectedPersonaId
  );

  const isActive = id === 'current' && (status === 'preparing' || status === 'analyzing');
  const displayElapsed = isActive ? elapsedMs : analysis.elapsedTime;

  const handleExportJson = () => {
    const json = JSON.stringify(analysis, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siteprobe-${analysis.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSONファイルをダウンロードしました');
  };

  const handleExportText = () => {
    const markdown = generateMarkdownReport(analysis);
    downloadTextFile(markdown, `siteprobe-${analysis.id}.txt`);
    toast.success('レポートをダウンロードしました');
  };

  const handleShare = async () => {
    const compressed = compressAnalysis(analysis);
    if (!compressed) {
      toast.error('共有データの生成に失敗しました');
      return;
    }
    const shareUrl = `${window.location.origin}/share#data=${compressed}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('共有URLをクリップボードにコピーしました');
    } catch {
      toast.error('コピーに失敗しました');
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">
            {analysis.url}
            {analysis.competitorUrl && (
              <span className="text-muted-foreground font-normal"> vs {analysis.competitorUrl}</span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {new Date(analysis.createdAt).toLocaleString('ja-JP')}
          </p>
        </div>
        {analysis.status === 'completed' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExportText}>
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">レポート</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExportJson}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">JSON</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleShare}>
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">共有</span>
            </Button>
          </div>
        )}
      </div>

      {/* プログレス（分析中のみ表示） */}
      {isActive && (
        <div className="px-4 py-3">
          <AnalysisProgress
            status={status}
            personaResults={analysis.personaResults}
            elapsedMs={displayElapsed}
            onCancel={cancelAnalysis}
          />
        </div>
      )}

      {/* メインコンテンツ */}
      <div className="flex">
        {/* デスクトップサイドバー */}
        <aside className="hidden lg:block w-80 shrink-0 border-r">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)]">
            <PersonaSidebar
              personaResults={analysis.personaResults}
              selectedId={selectedPersonaId}
              onSelect={setSelectedPersonaId}
            />
          </div>
        </aside>

        {/* メインエリア */}
        <div className="flex-1 min-w-0 p-4 space-y-6">
          {/* 競合比較バナー */}
          {analysis.competitorUrls && analysis.competitorUrls.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 px-4 py-2.5">
              <GitCompareArrows className="h-4 w-4 text-blue-500 shrink-0" />
              <div className="text-sm min-w-0">
                <span className="text-muted-foreground">比較対象: </span>
                {analysis.competitorUrls.map((url, i) => (
                  <span key={url}>
                    {i > 0 && <span className="text-muted-foreground">{' / '}</span>}
                    <span className="font-medium">{url}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* スコアダッシュボード */}
          {(analysis.status === 'completed' || analysis.overallScore > 0) && (
            <ScoreDashboard
              overallScore={analysis.overallScore}
              categoryScores={analysis.categoryScores}
            />
          )}

          {/* 優先改善サマリー（分析完了時） */}
          {analysis.status === 'completed' && (
            <PrioritySummary personaResults={analysis.personaResults} />
          )}

          {/* 改善ロードマップ（分析完了時） */}
          {analysis.status === 'completed' && (
            <RoadmapView
              personaResults={analysis.personaResults}
              overallScore={analysis.overallScore}
            />
          )}

          {/* 競合比較ダッシュボード */}
          {analysis.status === 'completed' && analysis.competitorQuickResults && analysis.competitorQuickResults.length > 0 && (
            <CompetitorDashboard
              mainUrl={analysis.url}
              mainOverallScore={analysis.overallScore}
              mainCategoryScores={analysis.categoryScores}
              competitorUrl={analysis.competitorUrl}
              competitorQuickResults={analysis.competitorQuickResults}
            />
          )}

          {/* スコア推移（分析完了時） */}
          {analysis.status === 'completed' && (
            <TrendChart url={analysis.url} />
          )}

          {/* モバイルサイドバー（Sheet） */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  ペルソナ一覧を表示
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="h-full pt-8">
                  <PersonaSidebar
                    personaResults={analysis.personaResults}
                    selectedId={selectedPersonaId}
                    onSelect={setSelectedPersonaId}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* 選択されたペルソナの結果 */}
          {selectedResult ? (
            <PersonaResultCard
              result={selectedResult}
              analysisId={analysis.id}
              analysisUrl={analysis.url}
              competitorUrl={analysis.competitorUrl}
              onRetry={id === 'current' ? retryPersona : undefined}
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? '分析完了したペルソナから順次表示されます'
                  : '左のサイドバーからペルソナを選択してください'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
