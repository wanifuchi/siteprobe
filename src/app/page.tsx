'use client';

import { useRouter } from 'next/navigation';
import { Users, Zap, BarChart3, Shield, Target, Search, Code, FileText } from 'lucide-react';
import { UrlInputForm } from '@/components/analysis/url-input-form';
import { usePersonaStore } from '@/stores/persona-store';
import { useAnalysisStore } from '@/stores/analysis-store';
import { useAnalysis } from '@/hooks/use-analysis';
import { CATEGORY_CONFIG } from '@/data/default-personas';

const FEATURES = [
  {
    icon: Users,
    title: '16人のAI専門家',
    description: 'マーケティング、デザイン、技術、ビジネスの専門家チームが多角的に分析',
  },
  {
    icon: Zap,
    title: 'リアルタイム進捗',
    description: '各専門家の分析状況をリアルタイムで確認。完了次第、順次結果を表示',
  },
  {
    icon: BarChart3,
    title: 'スコア&レポート',
    description: '総合スコア・カテゴリ別スコアに加え、具体的な改善提案をレポート化',
  },
  {
    icon: Shield,
    title: 'カスタマイズ可能',
    description: 'ペルソナの追加・編集が自由。あなたの分析ニーズに合わせてチームを構成',
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  marketing: Target,
  design: FileText,
  technical: Code,
  business: BarChart3,
  user: Search,
};

export default function HomePage() {
  const router = useRouter();
  const getEnabledPersonas = usePersonaStore((s) => s.getEnabledPersonas);
  const status = useAnalysisStore((s) => s.status);
  const { runAnalysis } = useAnalysis();

  const handleSubmit = async (url: string, competitorUrl?: string, additionalCompetitorUrls?: string[]) => {
    const personas = getEnabledPersonas();
    if (personas.length === 0) {
      return;
    }
    // 分析ページに遷移してから分析開始
    router.push('/analyze/current');
    await runAnalysis(url, personas, competitorUrl, additionalCompetitorUrls);
  };

  const isLoading = status === 'preparing' || status === 'analyzing';

  return (
    <div className="flex flex-col items-center">
      {/* ヒーローセクション */}
      <section className="w-full px-4 pt-16 pb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          AI専門家チームが
          <br className="sm:hidden" />
          <span className="text-primary"> サイトを分析</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground text-base sm:text-lg">
          URLを入力するだけで、マーケティング・SEO・デザイン・技術・ビジネスの
          専門家チームがあなたのサイトを多角的に分析し、改善提案を行います。
        </p>

        {/* URL入力フォーム */}
        <div className="mt-8 px-4">
          <UrlInputForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        {/* ペルソナカテゴリ表示 */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const Icon = CATEGORY_ICONS[key] || Users;
            return (
              <div
                key={key}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: config.color, color: config.color }}
              >
                <Icon className="h-3 w-3" />
                {config.label}
              </div>
            );
          })}
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="w-full max-w-5xl px-4 py-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border bg-card p-6 text-center"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-sm">{title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
