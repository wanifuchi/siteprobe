'use client';

import { useMemo } from 'react';
import { ListOrdered } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FindingCard } from './finding-card';
import type { PersonaResult, Finding } from '@/types';

interface FindingWithPersona {
  finding: Finding;
  personaName: string;
}

interface PrioritySummaryProps {
  personaResults: PersonaResult[];
}

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const MAX_ITEMS = 10;

export function PrioritySummary({ personaResults }: PrioritySummaryProps) {
  const topFindings = useMemo(() => {
    const all: FindingWithPersona[] = [];
    for (const pr of personaResults) {
      if (pr.status !== 'completed') continue;
      for (const f of pr.findings) {
        all.push({ finding: f, personaName: pr.personaName });
      }
    }
    all.sort((a, b) => (SEVERITY_ORDER[a.finding.severity] ?? 2) - (SEVERITY_ORDER[b.finding.severity] ?? 2));
    return all.slice(0, MAX_ITEMS);
  }, [personaResults]);

  if (topFindings.length === 0) return null;

  const highCount = topFindings.filter((f) => f.finding.severity === 'high').length;
  const mediumCount = topFindings.filter((f) => f.finding.severity === 'medium').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListOrdered className="h-5 w-5" />
          優先改善サマリー
          <span className="text-xs text-muted-foreground font-normal">
            （全ペルソナの上位{topFindings.length}件）
          </span>
        </CardTitle>
        <div className="flex gap-2 mt-1">
          {highCount > 0 && (
            <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              高 {highCount}件
            </Badge>
          )}
          {mediumCount > 0 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              中 {mediumCount}件
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {topFindings.map((item, i) => (
          <div key={`${item.finding.id}-${i}`}>
            <div className="mb-1">
              <Badge variant="outline" className="text-xs">
                {item.personaName}
              </Badge>
            </div>
            <FindingCard finding={item.finding} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
