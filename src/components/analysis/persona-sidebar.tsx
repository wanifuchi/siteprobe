'use client';

import { CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CATEGORY_CONFIG, getScoreLabel } from '@/data/default-personas';
import type { PersonaResult, PersonaCategory } from '@/types';

interface PersonaSidebarProps {
  personaResults: PersonaResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_ICON = {
  waiting: Clock,
  analyzing: Loader2,
  completed: CheckCircle2,
  error: AlertCircle,
};

export function PersonaSidebar({ personaResults, selectedId, onSelect }: PersonaSidebarProps) {
  // カテゴリ別にグループ化
  const grouped = new Map<PersonaCategory, PersonaResult[]>();
  for (const r of personaResults) {
    const list = grouped.get(r.personaCategory) ?? [];
    list.push(r);
    grouped.set(r.personaCategory, list);
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-2">
        {Array.from(grouped.entries()).map(([category, results]) => {
          const config = CATEGORY_CONFIG[category];
          return (
            <div key={category}>
              {/* カテゴリヘッダー */}
              <div className="mb-1 px-2">
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: config?.color }}
                >
                  {config?.label || category}
                </span>
              </div>

              {/* ペルソナ一覧 */}
              <div className="space-y-0.5">
                {results.map((r) => {
                  const Icon = STATUS_ICON[r.status];
                  const isSelected = selectedId === r.personaId;
                  const scoreLabel = r.status === 'completed' ? getScoreLabel(r.score) : null;

                  return (
                    <button
                      key={r.personaId}
                      onClick={() => onSelect(r.personaId)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors text-left',
                        isSelected
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          r.status === 'analyzing' && 'animate-spin text-blue-500',
                          r.status === 'completed' && 'text-emerald-500',
                          r.status === 'error' && 'text-destructive'
                        )}
                      />
                      <span className="truncate flex-1">{r.personaName}</span>
                      {scoreLabel && (
                        <span
                          className="text-xs font-medium shrink-0"
                          style={{ color: scoreLabel.color }}
                        >
                          {r.score}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
