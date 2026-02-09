'use client';

import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import type { Finding } from '@/types';

const SEVERITY_CONFIG = {
  high: {
    icon: AlertTriangle,
    label: '高',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  medium: {
    icon: AlertCircle,
    label: '中',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  low: {
    icon: Info,
    label: '低',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

interface FindingCardProps {
  finding: Finding;
}

export function FindingCard({ finding }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[finding.severity];
  const Icon = config.icon;

  return (
    <div className="rounded-lg border p-4 space-y-2">
      {/* ヘッダー */}
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">{finding.title}</h4>
            <Badge variant="secondary" className={config.className}>
              {config.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {finding.category}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{finding.description}</p>
        </div>
      </div>

      {/* 改善提案 */}
      <div className="ml-8 rounded-md bg-muted/50 p-3">
        <p className="text-sm font-medium mb-1">改善提案</p>
        <p className="text-sm text-muted-foreground">{finding.recommendation}</p>
      </div>

      {/* コード例（折りたたみ） */}
      {finding.codeExample && (
        <div className="ml-8">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            コード例を{expanded ? '閉じる' : '表示'}
          </button>
          {expanded && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs font-mono">
              <code>{finding.codeExample}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
