'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingUp, Zap, Calendar, Target, Map } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { buildRoadmap } from '@/lib/roadmap';
import type { PersonaResult, ImprovementRoadmap, RoadmapPhase, Finding } from '@/types';

interface RoadmapViewProps {
  personaResults: PersonaResult[];
  overallScore: number;
}

const EFFORT_CONFIG = {
  quick: { label: '短時間', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  moderate: { label: '中程度', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  significant: { label: '大規模', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
};

const PHASE_ICONS = [Zap, Calendar, Target];

export function RoadmapView({ personaResults, overallScore }: RoadmapViewProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1]));

  // 全ペルソナのFindingsを統合してロードマップを構築
  const roadmap = useMemo(() => {
    const allFindings = personaResults
      .filter((r) => r.status === 'completed')
      .flatMap((r) => r.findings);

    if (allFindings.length === 0) return null;

    return buildRoadmap(allFindings, overallScore);
  }, [personaResults, overallScore]);

  if (!roadmap || roadmap.phases.length === 0) return null;

  const togglePhase = (phase: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="h-4 w-4" />
            改善ロードマップ
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              合計 {roadmap.totalEstimatedHours}h
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              {roadmap.currentScore} → {roadmap.expectedFinalScore}点
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* スコアプログレスバー */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>現在のスコア</span>
            <span>改善後の期待スコア</span>
          </div>
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/40 transition-all"
              style={{ width: `${roadmap.expectedFinalScore}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
              style={{ width: `${roadmap.currentScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span>{roadmap.currentScore}点</span>
            <span className="text-primary">+{roadmap.expectedFinalScore - roadmap.currentScore}点 → {roadmap.expectedFinalScore}点</span>
          </div>
        </div>

        <Separator />

        {/* フェーズ一覧 */}
        {roadmap.phases.map((phase) => (
          <PhaseSection
            key={phase.phase}
            phase={phase}
            isExpanded={expandedPhases.has(phase.phase)}
            onToggle={() => togglePhase(phase.phase)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function PhaseSection({
  phase,
  isExpanded,
  onToggle,
}: {
  phase: RoadmapPhase;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const PhaseIcon = PHASE_ICONS[phase.phase - 1] ?? Target;

  return (
    <div className="rounded-lg border">
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors"
      >
        <PhaseIcon className="h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Phase {phase.phase}: {phase.label}
            </span>
            <Badge variant="secondary" className="text-xs">
              {phase.findings.length}件
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {phase.estimatedTotalHours}h
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +{phase.expectedScoreGain}点
            </span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t px-4 py-2 space-y-2">
          {phase.findings.map((finding, i) => (
            <RoadmapFindingItem key={`${finding.id}-${i}`} finding={finding} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoadmapFindingItem({ finding }: { finding: Finding }) {
  const effort = finding.effortLevel ? EFFORT_CONFIG[finding.effortLevel] : null;
  const severityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-amber-500',
    low: 'border-l-blue-500',
  };

  return (
    <div className={`border-l-2 ${severityColors[finding.severity]} pl-3 py-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{finding.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {finding.recommendation}
          </p>
        </div>
        {finding.priority && (
          <Badge variant="outline" className="text-xs shrink-0">
            #{finding.priority}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-xs">
        {finding.estimatedHours !== undefined && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {finding.estimatedHours}h
          </span>
        )}
        {finding.estimatedScoreImpact !== undefined && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            +{finding.estimatedScoreImpact}pt
          </span>
        )}
        {effort && (
          <span className={`${effort.color}`}>
            {effort.label}
          </span>
        )}
      </div>
    </div>
  );
}
