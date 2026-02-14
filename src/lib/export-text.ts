// マークダウン形式のレポート生成ユーティリティ

import { CATEGORY_CONFIG, getScoreLabel } from '@/data/default-personas';
import type { AnalysisResult, PersonaResult, PersonaCategory } from '@/types';

const SEVERITY_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

/**
 * 分析結果をマークダウン形式のレポートに変換
 */
export function generateMarkdownReport(analysis: AnalysisResult): string {
  const scoreLabel = getScoreLabel(analysis.overallScore);
  const date = new Date(analysis.createdAt).toLocaleString('ja-JP');
  const lines: string[] = [];

  // ヘッダー
  lines.push('# SiteProbe 分析レポート');
  lines.push('');
  lines.push(`- **URL**: ${analysis.url}`);
  if (analysis.competitorUrl) {
    lines.push(`- **競合URL（詳細分析）**: ${analysis.competitorUrl}`);
  }
  if (analysis.competitorUrls && analysis.competitorUrls.length > 1) {
    const additionalUrls = analysis.competitorUrls.slice(1);
    for (const url of additionalUrls) {
      lines.push(`- **競合URL（簡易分析）**: ${url}`);
    }
  }
  lines.push(`- **分析日**: ${date}`);
  lines.push(`- **総合スコア**: ${analysis.overallScore}/100（${scoreLabel.label}）`);
  lines.push('');

  // カテゴリ別スコア
  lines.push('## カテゴリ別スコア');
  lines.push('');
  lines.push('| カテゴリ | スコア |');
  lines.push('|----------|--------|');
  for (const cs of analysis.categoryScores) {
    lines.push(`| ${cs.label} | ${cs.score}点 |`);
  }
  lines.push('');

  // カテゴリ別にペルソナをグループ化
  const grouped = new Map<PersonaCategory, PersonaResult[]>();
  for (const p of analysis.personaResults) {
    if (p.status !== 'completed') continue;
    const list = grouped.get(p.personaCategory) ?? [];
    list.push(p);
    grouped.set(p.personaCategory, list);
  }

  // 各ペルソナの詳細
  lines.push('---');
  lines.push('');

  for (const [category, personas] of grouped) {
    const config = CATEGORY_CONFIG[category];
    const catScore = analysis.categoryScores.find((cs) => cs.category === category);
    lines.push(`## ${config?.label || category}（${catScore?.score ?? '-'}点）`);
    lines.push('');

    for (const persona of personas) {
      lines.push(`### ${persona.personaName} - ${persona.score}点`);
      lines.push('');
      lines.push(`> ${persona.summary}`);
      lines.push('');

      if (persona.findings.length > 0) {
        lines.push('#### 指摘事項');
        lines.push('');
        for (const finding of persona.findings) {
          const sev = SEVERITY_LABEL[finding.severity] || finding.severity;
          lines.push(`**[${sev}] ${finding.title}**`);
          lines.push('');
          lines.push(finding.description);
          lines.push('');
          if (finding.recommendation) {
            lines.push(`💡 **改善提案**: ${finding.recommendation}`);
            lines.push('');
          }
          if (finding.codeExample) {
            lines.push('```');
            lines.push(finding.codeExample);
            lines.push('```');
            lines.push('');
          }
        }
      }

      if (persona.competitorComparison) {
        const comp = persona.competitorComparison;
        lines.push('#### 競合比較');
        lines.push('');
        if (comp.overallAssessment) {
          lines.push(comp.overallAssessment);
          lines.push('');
        }
        if (comp.mainSiteAdvantages.length > 0) {
          lines.push('**自サイトが優れている点:**');
          for (const item of comp.mainSiteAdvantages) {
            lines.push(`- ${item}`);
          }
          lines.push('');
        }
        if (comp.competitorAdvantages.length > 0) {
          lines.push('**競合が優れている点:**');
          for (const item of comp.competitorAdvantages) {
            lines.push(`- ${item}`);
          }
          lines.push('');
        }
        if (comp.suggestions.length > 0) {
          lines.push('**競合から学べる改善案:**');
          for (const item of comp.suggestions) {
            lines.push(`- ${item}`);
          }
          lines.push('');
        }
      }

      if (persona.thinkingProcess) {
        lines.push('<details>');
        lines.push('<summary>分析の思考過程</summary>');
        lines.push('');
        lines.push(persona.thinkingProcess);
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }
    }
  }

  // 競合簡易分析結果
  if (analysis.competitorQuickResults && analysis.competitorQuickResults.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 競合サイト簡易分析');
    lines.push('');
    for (const comp of analysis.competitorQuickResults) {
      lines.push(`### ${comp.url}（総合: ${comp.overallScore}点）`);
      lines.push('');
      lines.push('| カテゴリ | スコア |');
      lines.push('|----------|--------|');
      for (const cs of comp.categoryScores) {
        lines.push(`| ${cs.label} | ${cs.score}点 |`);
      }
      lines.push('');
      if (comp.strengths.length > 0) {
        lines.push('**強み:**');
        for (const s of comp.strengths) {
          lines.push(`- ${s}`);
        }
        lines.push('');
      }
      if (comp.weaknesses.length > 0) {
        lines.push('**弱み:**');
        for (const w of comp.weaknesses) {
          lines.push(`- ${w}`);
        }
        lines.push('');
      }
    }
  }

  // フッター
  lines.push('---');
  lines.push('*Generated by SiteProbe - AI専門家チームによるサイト分析*');

  return lines.join('\n');
}

/**
 * テキストをファイルとしてダウンロード
 */
export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
