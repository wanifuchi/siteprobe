'use client';

import { useMemo, useState } from 'react';
import { ListOrdered, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  const [open, setOpen] = useState(false);

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
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ListOrdered className="h-4 w-4" />
            優先改善サマリー
            <span className="text-xs text-muted-foreground font-normal">
              （上位{topFindings.length}件）
            </span>
          </div>
          <div className="flex items-center gap-2">
            {highCount > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                高 {highCount}
              </Badge>
            )}
            {mediumCount > 0 && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                中 {mediumCount}
              </Badge>
            )}
            <Chevron className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-3">
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
      )}
    </Card>
  );
}
