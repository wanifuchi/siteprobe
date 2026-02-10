// 分析結果の共有ユーティリティ（lz-string圧縮 + URLフラグメント）

import lzString from 'lz-string';
import type { AnalysisResult } from '@/types';

// 共有用の軽量データ（ScrapedDataのHTMLを除外してサイズ削減）
interface ShareData {
  v: 1; // バージョン
  url: string;
  date: string;
  score: number;
  categories: { cat: string; label: string; score: number }[];
  personas: {
    name: string;
    cat: string;
    score: number;
    summary: string;
    findings: {
      sev: string;
      title: string;
      desc: string;
      rec: string;
      code?: string;
    }[];
    thinking: string;
  }[];
}

/**
 * 分析結果を圧縮して共有用文字列に変換
 */
export function compressAnalysis(analysis: AnalysisResult): string | null {
  const shareData: ShareData = {
    v: 1,
    url: analysis.url,
    date: analysis.createdAt,
    score: analysis.overallScore,
    categories: analysis.categoryScores.map((cs) => ({
      cat: cs.category,
      label: cs.label,
      score: cs.score,
    })),
    personas: analysis.personaResults
      .filter((p) => p.status === 'completed')
      .map((p) => ({
        name: p.personaName,
        cat: p.personaCategory,
        score: p.score,
        summary: p.summary,
        findings: p.findings.map((f) => ({
          sev: f.severity,
          title: f.title,
          desc: f.description,
          rec: f.recommendation,
          ...(f.codeExample ? { code: f.codeExample } : {}),
        })),
        thinking: p.thinkingProcess,
      })),
  };

  try {
    const json = JSON.stringify(shareData);
    const compressed = lzString.compressToEncodedURIComponent(json);
    return compressed;
  } catch {
    return null;
  }
}

/**
 * 共有用文字列から分析結果を展開
 */
export function decompressAnalysis(compressed: string): ShareData | null {
  try {
    const json = lzString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    const data = JSON.parse(json) as ShareData;
    if (data.v !== 1 || !data.url || !data.personas) return null;
    return data;
  } catch {
    return null;
  }
}

export type { ShareData };
