'use client';

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import pLimit from 'p-limit';
import { useAnalysisStore } from '@/stores/analysis-store';
import { useHistoryStore } from '@/stores/history-store';
import { useTrendStore } from '@/stores/trend-store';
import type { Persona, ScrapedData, PersonaAnalyzeResponse, ScrapeResponse, CompetitorQuickResponse, CompetitorQuickResult } from '@/types';

const CONCURRENCY = 3; // 同時分析数

/**
 * 分析オーケストレーションフック
 * URLのスクレイピング → 各ペルソナの並列分析 → 結果保存
 */
export function useAnalysis() {
  const store = useAnalysisStore();
  const addToHistory = useHistoryStore((s) => s.addAnalysis);
  const abortRef = useRef<AbortController | null>(null);

  const runAnalysis = useCallback(
    async (url: string, personas: Persona[], competitorUrl?: string, additionalCompetitorUrls?: string[]) => {
      // 前回の分析を中断
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      // 分析状態を初期化
      store.startAnalysis(url, personas, competitorUrl);

      // 全競合URL一覧を記録
      const allCompetitorUrls = [competitorUrl, ...(additionalCompetitorUrls ?? [])].filter((u): u is string => !!u);
      if (allCompetitorUrls.length > 0) {
        store.setCompetitorUrls(allCompetitorUrls);
      }

      // 1. メインサイトのスクレイピング
      let scrapedData: ScrapedData;
      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: abort.signal,
        });
        const data: ScrapeResponse = await res.json();

        if (!data.success || !data.data) {
          store.setError(data.error || 'スクレイピングに失敗しました');
          toast.error(data.error || 'スクレイピングに失敗しました');
          return;
        }

        scrapedData = data.data;
        store.setScrapedData(scrapedData);
      } catch (error: unknown) {
        if (abort.signal.aborted) return;
        const msg = error instanceof Error ? error.message : 'スクレイピングエラー';
        store.setError(msg);
        toast.error(msg);
        return;
      }

      // 2. 競合サイトのスクレイピング（URLが指定されている場合）
      let competitorScrapedData: ScrapedData | undefined;
      if (competitorUrl) {
        try {
          const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: competitorUrl }),
            signal: abort.signal,
          });
          const data: ScrapeResponse = await res.json();

          if (data.success && data.data) {
            competitorScrapedData = data.data;
            store.setCompetitorScrapedData(data.data);
          } else {
            // 競合スクレイピング失敗は警告のみで続行
            toast.warning('競合サイトの取得に失敗しました。メインサイトのみ分析します');
          }
        } catch (error: unknown) {
          if (abort.signal.aborted) return;
          toast.warning('競合サイトの取得に失敗しました。メインサイトのみ分析します');
        }
      }

      // 3. 各ペルソナで並列分析
      const limit = pLimit(CONCURRENCY);

      const tasks = personas.map((persona) =>
        limit(async () => {
          if (abort.signal.aborted) return;

          // ステータスを「分析中」に更新
          store.updatePersonaStatus(persona.id, 'analyzing');

          try {
            const res = await fetch('/api/analyze/persona', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scrapedData,
                persona,
                ...(competitorScrapedData ? { competitorScrapedData } : {}),
              }),
              signal: abort.signal,
            });

            const data: PersonaAnalyzeResponse = await res.json();

            if (abort.signal.aborted) return;

            if (data.success && data.result) {
              store.setPersonaResult(persona.id, {
                status: 'completed',
                score: data.result.score,
                summary: data.result.summary,
                findings: data.result.findings,
                thinkingProcess: data.result.thinkingProcess,
                competitorComparison: data.result.competitorComparison,
              });
            } else {
              store.setPersonaResult(persona.id, {
                status: 'error',
                error: data.error || '分析に失敗しました',
              });
            }
          } catch (error: unknown) {
            if (abort.signal.aborted) return;
            store.setPersonaResult(persona.id, {
              status: 'error',
              error: error instanceof Error ? error.message : '分析エラー',
            });
          }
        })
      );

      await Promise.allSettled(tasks);

      if (abort.signal.aborted) return;

      // 3.5. 追加競合サイトの簡易分析（2-3社目）
      if (additionalCompetitorUrls && additionalCompetitorUrls.length > 0) {
        const quickResults: CompetitorQuickResult[] = [];

        // 追加競合の並列スクレイピング+簡易分析
        const quickTasks = additionalCompetitorUrls.map((compUrl) =>
          limit(async (): Promise<void> => {
            if (abort.signal.aborted) return;

            try {
              // スクレイピング
              const scrapeRes = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: compUrl }),
                signal: abort.signal,
              });
              const scrapeData: ScrapeResponse = await scrapeRes.json();

              if (!scrapeData.success || !scrapeData.data) {
                toast.warning(`競合サイト（${compUrl}）の取得に失敗しました`);
                return;
              }

              // 簡易分析
              const analyzeRes = await fetch('/api/analyze/competitor-quick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scrapedData: scrapeData.data }),
                signal: abort.signal,
              });
              const analyzeData: CompetitorQuickResponse = await analyzeRes.json();

              if (analyzeData.success && analyzeData.result) {
                quickResults.push(analyzeData.result);
              } else {
                toast.warning(`競合サイト（${compUrl}）の簡易分析に失敗しました`);
              }
            } catch (error: unknown) {
              if (abort.signal.aborted) return;
              toast.warning(`競合サイト（${compUrl}）の分析に失敗しました`);
            }
          })
        );

        await Promise.allSettled(quickTasks);

        if (abort.signal.aborted) return;

        if (quickResults.length > 0) {
          store.setCompetitorQuickResults(quickResults);
        }
      }

      // 4. 分析完了
      store.completeAnalysis();

      // 5. 履歴に保存 + トレンド記録
      const finalState = useAnalysisStore.getState();
      if (finalState.currentAnalysis) {
        addToHistory(finalState.currentAnalysis);

        // トレンドデータを記録
        useTrendStore.getState().addDataPoint(url, {
          analysisId: finalState.currentAnalysis.id,
          date: finalState.currentAnalysis.createdAt,
          overallScore: finalState.currentAnalysis.overallScore,
          categoryScores: finalState.currentAnalysis.categoryScores,
        });
      }

      toast.success('分析が完了しました');
    },
    [store, addToHistory]
  );

  const retryPersona = useCallback(
    async (personaId: string) => {
      const state = useAnalysisStore.getState();
      const analysis = state.currentAnalysis;
      if (!analysis?.scrapedData) {
        toast.error('分析データが見つかりません。全体を再分析してください');
        return;
      }

      // ペルソナストアから完全なペルソナデータを取得
      const { usePersonaStore } = await import('@/stores/persona-store');
      const persona = usePersonaStore.getState().personas.find((p) => p.id === personaId);
      if (!persona) {
        toast.error('ペルソナが見つかりません');
        return;
      }

      store.updatePersonaStatus(personaId, 'analyzing');

      try {
        const res = await fetch('/api/analyze/persona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scrapedData: analysis.scrapedData,
            persona,
            ...(analysis.competitorScrapedData ? { competitorScrapedData: analysis.competitorScrapedData } : {}),
          }),
        });

        const data: PersonaAnalyzeResponse = await res.json();

        if (data.success && data.result) {
          store.setPersonaResult(personaId, {
            status: 'completed',
            score: data.result.score,
            summary: data.result.summary,
            findings: data.result.findings,
            thinkingProcess: data.result.thinkingProcess,
            competitorComparison: data.result.competitorComparison,
          });

          // 履歴も更新
          const finalState = useAnalysisStore.getState();
          if (finalState.currentAnalysis) {
            addToHistory(finalState.currentAnalysis);
          }

          toast.success(`${persona.name}の再分析が完了しました`);
        } else {
          store.setPersonaResult(personaId, {
            status: 'error',
            error: data.error || '分析に失敗しました',
          });
          toast.error(data.error || '再分析に失敗しました');
        }
      } catch (error: unknown) {
        store.setPersonaResult(personaId, {
          status: 'error',
          error: error instanceof Error ? error.message : '分析エラー',
        });
        toast.error('再分析に失敗しました');
      } finally {
        store.completeAnalysis();
      }
    },
    [store, addToHistory]
  );

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
    store.cancelAnalysis();
    toast.info('分析をキャンセルしました');
  }, [store]);

  return { runAnalysis, retryPersona, cancelAnalysis };
}
