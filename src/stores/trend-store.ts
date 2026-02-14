import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrendDataPoint, UrlTrend } from '@/types';

const MAX_POINTS_PER_URL = 50;

/**
 * URLを正規化する（末尾スラッシュ統一、小文字化）
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // パスの末尾スラッシュを除去（ルートは除く）
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

interface TrendStore {
  trends: Record<string, UrlTrend>; // normalizedUrl -> UrlTrend
  addDataPoint: (url: string, point: TrendDataPoint) => void;
  getTrend: (url: string) => UrlTrend | null;
  getUrls: () => string[];
}

export const useTrendStore = create<TrendStore>()(
  persist(
    (set, get) => ({
      trends: {},

      addDataPoint: (url: string, point: TrendDataPoint) =>
        set((state) => {
          const key = normalizeUrl(url);
          const existing = state.trends[key];

          let dataPoints = existing?.dataPoints ?? [];

          // 同じanalysisIdがあれば更新、なければ追加
          const existingIndex = dataPoints.findIndex((p) => p.analysisId === point.analysisId);
          if (existingIndex >= 0) {
            dataPoints = [...dataPoints];
            dataPoints[existingIndex] = point;
          } else {
            dataPoints = [...dataPoints, point];
          }

          // 最大ポイント数を超えた場合は古いものを削除
          if (dataPoints.length > MAX_POINTS_PER_URL) {
            dataPoints = dataPoints.slice(-MAX_POINTS_PER_URL);
          }

          return {
            trends: {
              ...state.trends,
              [key]: { url, dataPoints },
            },
          };
        }),

      getTrend: (url: string) => {
        const key = normalizeUrl(url);
        return get().trends[key] ?? null;
      },

      getUrls: () => {
        return Object.values(get().trends).map((t) => t.url);
      },
    }),
    {
      name: 'siteprobe-trends',
    }
  )
);
