import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AnalysisResult, AnalysisHistoryItem } from '@/types';

const MAX_HISTORY_COUNT = 20;
const STORAGE_LIMIT_BYTES = 4 * 1024 * 1024; // 4MB
const DETAIL_KEY_PREFIX = 'siteprobe-detail-';

// AnalysisResult を軽量な AnalysisHistoryItem に変換
function toHistoryItem(result: AnalysisResult): AnalysisHistoryItem {
  return {
    id: result.id,
    url: result.url,
    createdAt: result.createdAt,
    overallScore: result.overallScore,
    categoryScores: result.categoryScores,
    personaCount: result.personaResults.length,
    completedPersonaCount: result.personaResults.filter(
      (r) => r.status === 'completed'
    ).length,
  };
}

// localStorage の使用量を概算で取得（バイト数）
function estimateLocalStorageUsage(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      // UTF-16 のため1文字あたり2バイトで概算
      total += (key.length + (value?.length ?? 0)) * 2;
    }
  }
  return total;
}

// 容量オーバー時に古い detail データから削除
function pruneDetailStorage(historyItems: AnalysisHistoryItem[]) {
  if (estimateLocalStorageUsage() <= STORAGE_LIMIT_BYTES) return;

  // 古い順に detail を削除
  const sortedByDate = [...historyItems].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const item of sortedByDate) {
    if (estimateLocalStorageUsage() <= STORAGE_LIMIT_BYTES) break;
    localStorage.removeItem(`${DETAIL_KEY_PREFIX}${item.id}`);
  }
}

interface HistoryStore {
  history: AnalysisHistoryItem[];
  addAnalysis: (result: AnalysisResult) => void;
  getAnalysisDetail: (id: string) => AnalysisResult | null;
  deleteAnalysis: (id: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      history: [],

      // 分析結果を履歴に追加
      addAnalysis: (result) =>
        set((state) => {
          const item = toHistoryItem(result);
          // 先頭に追加し、最大件数を超えた分は削除
          let updated = [item, ...state.history];
          if (updated.length > MAX_HISTORY_COUNT) {
            const removed = updated.slice(MAX_HISTORY_COUNT);
            updated = updated.slice(0, MAX_HISTORY_COUNT);
            // 削除された履歴の detail も削除
            for (const old of removed) {
              localStorage.removeItem(`${DETAIL_KEY_PREFIX}${old.id}`);
            }
          }

          // 詳細データを別キーで保存
          try {
            localStorage.setItem(
              `${DETAIL_KEY_PREFIX}${result.id}`,
              JSON.stringify(result)
            );
          } catch {
            // 容量不足の場合は古い detail を削除してリトライ
            pruneDetailStorage(updated);
            try {
              localStorage.setItem(
                `${DETAIL_KEY_PREFIX}${result.id}`,
                JSON.stringify(result)
              );
            } catch {
              // それでも保存できない場合は detail なしで続行
            }
          }

          // 全体の容量チェック
          pruneDetailStorage(updated);

          return { history: updated };
        }),

      // 詳細な分析結果を取得
      getAnalysisDetail: (id) => {
        try {
          const raw = localStorage.getItem(`${DETAIL_KEY_PREFIX}${id}`);
          return raw ? (JSON.parse(raw) as AnalysisResult) : null;
        } catch {
          return null;
        }
      },

      // 指定した分析を削除
      deleteAnalysis: (id) =>
        set((state) => {
          localStorage.removeItem(`${DETAIL_KEY_PREFIX}${id}`);
          return {
            history: state.history.filter((h) => h.id !== id),
          };
        }),

      // 全履歴を削除
      clearHistory: () =>
        set((state) => {
          // 全 detail データを削除
          for (const item of state.history) {
            localStorage.removeItem(`${DETAIL_KEY_PREFIX}${item.id}`);
          }
          return { history: [] };
        }),
    }),
    {
      name: 'siteprobe-history',
    }
  )
);
