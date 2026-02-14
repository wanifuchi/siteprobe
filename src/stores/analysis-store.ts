import { create } from 'zustand';
import {
  AnalysisState,
  AnalysisResult,
  PersonaResult,
  PersonaAnalysisStatus,
  CategoryScore,
  Persona,
  ScrapedData,
  CompetitorQuickResult,
} from '@/types';
import { CATEGORY_CONFIG } from '@/data/default-personas';

// カテゴリスコアを計算（同カテゴリのペルソナスコア平均値）
function calculateCategoryScores(personaResults: PersonaResult[]): CategoryScore[] {
  const completedResults = personaResults.filter((r) => r.status === 'completed');
  if (completedResults.length === 0) return [];

  // カテゴリごとにスコアを集計
  const categoryMap = new Map<string, number[]>();
  for (const result of completedResults) {
    const scores = categoryMap.get(result.personaCategory) ?? [];
    scores.push(result.score);
    categoryMap.set(result.personaCategory, scores);
  }

  // カテゴリごとの平均スコアを算出
  return Array.from(categoryMap.entries()).map(([category, scores]) => {
    const config = CATEGORY_CONFIG[category] ?? { label: category, color: '#94a3b8' };
    return {
      category: category as CategoryScore['category'],
      label: config.label,
      score: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
      color: config.color,
    };
  });
}

// 全体スコアを計算（全ペルソナスコアの平均値）
function calculateOverallScore(personaResults: PersonaResult[]): number {
  const completedResults = personaResults.filter((r) => r.status === 'completed');
  if (completedResults.length === 0) return 0;
  const total = completedResults.reduce((sum, r) => sum + r.score, 0);
  return Math.round(total / completedResults.length);
}

export const useAnalysisStore = create<AnalysisState>()((set, get) => ({
  status: 'idle',
  currentAnalysis: null,

  // 分析を開始（AnalysisResult を初期化）
  startAnalysis: (url: string, personas: Persona[], competitorUrl?: string) => {
    const analysisId = `analysis-${Date.now()}`;
    const personaResults: PersonaResult[] = personas.map((p) => ({
      personaId: p.id,
      personaName: p.name,
      personaIcon: p.icon,
      personaCategory: p.category,
      status: 'waiting' as const,
      score: 0,
      summary: '',
      findings: [],
      thinkingProcess: '',
    }));

    const analysis: AnalysisResult = {
      id: analysisId,
      url,
      createdAt: new Date().toISOString(),
      status: 'preparing',
      scrapedData: null,
      personaResults,
      overallScore: 0,
      categoryScores: [],
      elapsedTime: 0,
      competitorUrl,
      competitorScrapedData: competitorUrl ? null : undefined,
    };

    set({ status: 'preparing', currentAnalysis: analysis });
  },

  // ペルソナの分析ステータスを更新
  updatePersonaStatus: (personaId: string, status: PersonaAnalysisStatus) =>
    set((state) => {
      if (!state.currentAnalysis) return state;
      const personaResults = state.currentAnalysis.personaResults.map((r) =>
        r.personaId === personaId ? { ...r, status } : r
      );
      // いずれかが analyzing なら全体も analyzing
      const hasAnalyzing = personaResults.some((r) => r.status === 'analyzing');
      return {
        status: hasAnalyzing ? 'analyzing' : state.status,
        currentAnalysis: {
          ...state.currentAnalysis,
          status: hasAnalyzing ? 'analyzing' : state.currentAnalysis.status,
          personaResults,
        },
      };
    }),

  // ペルソナの分析結果をセットし、全体スコアを再計算
  setPersonaResult: (personaId: string, result: Partial<PersonaResult>) =>
    set((state) => {
      if (!state.currentAnalysis) return state;
      const personaResults = state.currentAnalysis.personaResults.map((r) =>
        r.personaId === personaId
          ? { ...r, ...result, completedAt: new Date().toISOString() }
          : r
      );
      const overallScore = calculateOverallScore(personaResults);
      const categoryScores = calculateCategoryScores(personaResults);

      return {
        currentAnalysis: {
          ...state.currentAnalysis,
          personaResults,
          overallScore,
          categoryScores,
        },
      };
    }),

  // スクレイピングデータをセット
  setScrapedData: (data: ScrapedData) =>
    set((state) => {
      if (!state.currentAnalysis) return state;
      return {
        currentAnalysis: {
          ...state.currentAnalysis,
          scrapedData: data,
        },
      };
    }),

  // 競合サイトのスクレイピングデータをセット
  setCompetitorScrapedData: (data: ScrapedData) =>
    set((state) => {
      if (!state.currentAnalysis) return state;
      return {
        currentAnalysis: {
          ...state.currentAnalysis,
          competitorScrapedData: data,
        },
      };
    }),

  // 複数競合URL一覧をセット
  setCompetitorUrls: (urls: string[]) =>
    set((state) => {
      if (!state.currentAnalysis) return state;
      return {
        currentAnalysis: {
          ...state.currentAnalysis,
          competitorUrls: urls,
        },
      };
    }),

  // 競合簡易分析結果をセット
  setCompetitorQuickResults: (results: CompetitorQuickResult[]) =>
    set((state) => {
      if (!state.currentAnalysis) return state;
      return {
        currentAnalysis: {
          ...state.currentAnalysis,
          competitorQuickResults: results,
        },
      };
    }),

  // 分析完了処理
  completeAnalysis: () =>
    set((state) => {
      if (!state.currentAnalysis) return state;
      const elapsed = Date.now() - new Date(state.currentAnalysis.createdAt).getTime();
      return {
        status: 'completed',
        currentAnalysis: {
          ...state.currentAnalysis,
          status: 'completed',
          elapsedTime: elapsed,
        },
      };
    }),

  // 分析キャンセル
  cancelAnalysis: () =>
    set((state) => {
      if (!state.currentAnalysis) return state;
      return {
        status: 'cancelled',
        currentAnalysis: {
          ...state.currentAnalysis,
          status: 'cancelled',
        },
      };
    }),

  // エラー設定
  setError: (error: string) =>
    set((state) => ({
      status: 'error',
      currentAnalysis: state.currentAnalysis
        ? { ...state.currentAnalysis, status: 'error' }
        : null,
    })),

  // 状態リセット
  reset: () =>
    set({ status: 'idle', currentAnalysis: null }),
}));
