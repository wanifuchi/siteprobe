// ルールベースの改善ロードマップ推定ロジック

import type { Finding, ImprovementRoadmap, RoadmapPhase } from '@/types';

interface FindingEstimate {
  estimatedHours: number;
  estimatedScoreImpact: number;
  effortLevel: 'quick' | 'moderate' | 'significant';
}

/**
 * 個別Findingの工数・効果をルールベースで推定する
 */
export function estimateFinding(finding: Finding): FindingEstimate {
  // severity別の基本工数マッピング
  const severityHoursMap: Record<string, [number, number]> = {
    high: [4, 8],
    medium: [2, 4],
    low: [0.5, 2],
  };

  const [minHours, maxHours] = severityHoursMap[finding.severity] ?? [1, 3];
  let hours = (minHours + maxHours) / 2;

  // コード例があれば工数20%減（実装のヒントが明確）
  if (finding.codeExample) {
    hours *= 0.8;
  }

  // severity別のスコア影響
  const scoreImpactMap: Record<string, [number, number]> = {
    high: [3, 5],
    medium: [1, 3],
    low: [0.5, 1],
  };

  const [minImpact, maxImpact] = scoreImpactMap[finding.severity] ?? [1, 2];
  const estimatedScoreImpact = (minImpact + maxImpact) / 2;

  // 工数レベル分類
  let effortLevel: 'quick' | 'moderate' | 'significant';
  if (hours <= 2) {
    effortLevel = 'quick';
  } else if (hours <= 8) {
    effortLevel = 'moderate';
  } else {
    effortLevel = 'significant';
  }

  return {
    estimatedHours: Math.round(hours * 10) / 10,
    estimatedScoreImpact: Math.round(estimatedScoreImpact * 10) / 10,
    effortLevel,
  };
}

/**
 * Findingsに推定値を付与する
 */
export function enrichFindings(findings: Finding[]): Finding[] {
  return findings.map((finding, index) => {
    const estimate = estimateFinding(finding);
    return {
      ...finding,
      estimatedHours: estimate.estimatedHours,
      estimatedScoreImpact: estimate.estimatedScoreImpact,
      effortLevel: estimate.effortLevel,
    };
  }).sort((a, b) => {
    // ROI（効果/工数）降順でソート
    const roiA = (a.estimatedScoreImpact ?? 0) / (a.estimatedHours ?? 1);
    const roiB = (b.estimatedScoreImpact ?? 0) / (b.estimatedHours ?? 1);
    return roiB - roiA;
  }).map((finding, index) => ({
    ...finding,
    priority: index + 1,
  }));
}

/**
 * 全ペルソナのFindingsからロードマップを構築する
 */
export function buildRoadmap(
  allFindings: Finding[],
  currentScore: number
): ImprovementRoadmap {
  // 推定値を付与
  const enriched = enrichFindings(allFindings);

  // フェーズ分類
  const quickItems = enriched.filter((f) => f.effortLevel === 'quick');
  const moderateItems = enriched.filter((f) => f.effortLevel === 'moderate');
  const significantItems = enriched.filter((f) => f.effortLevel === 'significant');

  const phases: RoadmapPhase[] = [];

  if (quickItems.length > 0) {
    phases.push({
      phase: 1,
      label: 'すぐできる改善',
      estimatedTotalHours: sumHours(quickItems),
      expectedScoreGain: sumScoreImpact(quickItems),
      findings: quickItems,
    });
  }

  if (moderateItems.length > 0) {
    phases.push({
      phase: phases.length + 1,
      label: '計画的に取り組む改善',
      estimatedTotalHours: sumHours(moderateItems),
      expectedScoreGain: sumScoreImpact(moderateItems),
      findings: moderateItems,
    });
  }

  if (significantItems.length > 0) {
    phases.push({
      phase: phases.length + 1,
      label: '中長期の改善',
      estimatedTotalHours: sumHours(significantItems),
      expectedScoreGain: sumScoreImpact(significantItems),
      findings: significantItems,
    });
  }

  const totalEstimatedHours = phases.reduce((sum, p) => sum + p.estimatedTotalHours, 0);
  const totalScoreGain = phases.reduce((sum, p) => sum + p.expectedScoreGain, 0);

  return {
    phases,
    totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
    expectedFinalScore: Math.min(100, Math.round(currentScore + totalScoreGain)),
    currentScore,
  };
}

function sumHours(findings: Finding[]): number {
  return Math.round(findings.reduce((sum, f) => sum + (f.estimatedHours ?? 0), 0) * 10) / 10;
}

function sumScoreImpact(findings: Finding[]): number {
  return Math.round(findings.reduce((sum, f) => sum + (f.estimatedScoreImpact ?? 0), 0) * 10) / 10;
}
