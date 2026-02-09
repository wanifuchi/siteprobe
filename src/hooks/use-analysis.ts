'use client';

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import pLimit from 'p-limit';
import { useAnalysisStore } from '@/stores/analysis-store';
import { useHistoryStore } from '@/stores/history-store';
import type { Persona, ScrapedData, PersonaAnalyzeResponse, ScrapeResponse } from '@/types';

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
    async (url: string, personas: Persona[]) => {
      // 前回の分析を中断
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      // 分析状態を初期化
      store.startAnalysis(url, personas);

      // 1. スクレイピング
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

      // 2. 各ペルソナで並列分析
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
              body: JSON.stringify({ scrapedData, persona }),
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

      // 3. 分析完了
      store.completeAnalysis();

      // 4. 履歴に保存
      const finalState = useAnalysisStore.getState();
      if (finalState.currentAnalysis) {
        addToHistory(finalState.currentAnalysis);
      }

      toast.success('分析が完了しました');
    },
    [store, addToHistory]
  );

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
    store.cancelAnalysis();
    toast.info('分析をキャンセルしました');
  }, [store]);

  return { runAnalysis, cancelAnalysis };
}
