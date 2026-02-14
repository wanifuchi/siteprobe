'use client';

import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { CATEGORY_CONFIG } from '@/data/default-personas';
import type { Persona, PersonaCategory } from '@/types';

interface PersonaFormProps {
  initialData?: Persona;
  onSubmit: (data: Omit<Persona, 'id' | 'isDefault' | 'enabled'>) => void;
  onCancel: () => void;
}

const ICON_OPTIONS = [
  'Target', 'Search', 'FileText', 'Share2', 'Palette', 'Users',
  'Accessibility', 'Smartphone', 'Zap', 'Shield', 'Code', 'Award',
  'TrendingUp', 'Scale', 'Eye', 'BarChart3', 'Globe', 'Heart',
  'Star', 'Lightbulb', 'BookOpen', 'Briefcase',
];

export function PersonaForm({ initialData, onSubmit, onCancel }: PersonaFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [specialty, setSpecialty] = useState(initialData?.specialty || '');
  const [analysisPoints, setAnalysisPoints] = useState(initialData?.analysisPoints || '');
  const [category, setCategory] = useState<PersonaCategory>(initialData?.category || 'user');
  const [icon, setIcon] = useState(initialData?.icon || 'Star');
  const [evaluationFramework, setEvaluationFramework] = useState(initialData?.evaluationFramework || '');
  const [scoringCriteria, setScoringCriteria] = useState(initialData?.scoringCriteria || '');
  const [exclusions, setExclusions] = useState(initialData?.exclusions || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // AIアシスト関連
  const [aiTheme, setAiTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(initialData?.evaluationFramework || initialData?.scoringCriteria || initialData?.exclusions)
  );

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = '名前を入力してください';
    if (name.length > 30) newErrors.name = '30文字以内で入力してください';
    if (!specialty.trim()) newErrors.specialty = '専門分野を入力してください';
    if (specialty.length > 50) newErrors.specialty = '50文字以内で入力してください';
    if (!analysisPoints.trim()) newErrors.analysisPoints = '分析観点を入力してください';
    if (analysisPoints.length > 500) newErrors.analysisPoints = '500文字以内で入力してください';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: name.trim(),
      specialty: specialty.trim(),
      analysisPoints: analysisPoints.trim(),
      category,
      icon,
      ...(evaluationFramework.trim() && { evaluationFramework: evaluationFramework.trim() }),
      ...(scoringCriteria.trim() && { scoringCriteria: scoringCriteria.trim() }),
      ...(exclusions.trim() && { exclusions: exclusions.trim() }),
    });
  };

  const handleAiGenerate = async () => {
    if (!aiTheme.trim()) {
      toast.error('テーマを入力してください');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/assist/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: aiTheme.trim() }),
      });
      const data = await res.json();
      if (data.success && data.persona) {
        setName(data.persona.name);
        setSpecialty(data.persona.specialty);
        setAnalysisPoints(data.persona.analysisPoints);
        setCategory(data.persona.category);
        setEvaluationFramework(data.persona.evaluationFramework);
        setScoringCriteria(data.persona.scoringCriteria);
        setExclusions(data.persona.exclusions);
        setShowAdvanced(true);
        setErrors({});
        toast.success('AIがペルソナ設定を生成しました');
      } else {
        toast.error(data.error || '生成に失敗しました');
      }
    } catch {
      toast.error('生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* AIアシスト */}
          <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              AIでペルソナを自動生成
            </div>
            <p className="text-xs text-muted-foreground">
              テーマを入力するとAIが全フィールドを自動生成します。生成後に手動で修正も可能です。
            </p>
            <div className="flex gap-2">
              <Input
                value={aiTheme}
                onChange={(e) => setAiTheme(e.target.value)}
                placeholder="例: アクセシビリティ専門家、法務コンプライアンス..."
                maxLength={200}
                disabled={isGenerating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleAiGenerate();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAiGenerate}
                disabled={isGenerating || !aiTheme.trim()}
                className="shrink-0 gap-1.5"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? '生成中...' : 'AIで生成'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* 名前 */}
          <div className="space-y-2">
            <Label htmlFor="name">ペルソナ名 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: データアナリスト"
              maxLength={30}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* 専門分野 */}
          <div className="space-y-2">
            <Label htmlFor="specialty">専門分野 *</Label>
            <Input
              id="specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="例: データ分析・BI"
              maxLength={50}
            />
            {errors.specialty && <p className="text-xs text-destructive">{errors.specialty}</p>}
          </div>

          {/* 分析観点 */}
          <div className="space-y-2">
            <Label htmlFor="analysisPoints">分析観点 *</Label>
            <Textarea
              id="analysisPoints"
              value={analysisPoints}
              onChange={(e) => setAnalysisPoints(e.target.value)}
              placeholder="例: データ可視化、ダッシュボード設計、KPI設定、分析フロー"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {analysisPoints.length}/500 - AIがこの観点でサイトを分析します
            </p>
            {errors.analysisPoints && (
              <p className="text-xs text-destructive">{errors.analysisPoints}</p>
            )}
          </div>

          {/* カテゴリ */}
          <div className="space-y-2">
            <Label>カテゴリ</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as PersonaCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* アイコン */}
          <div className="space-y-2">
            <Label>アイコン</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    icon === name
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'hover:bg-accent'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* 詳細設定（折りたたみ） */}
          <Separator />
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              詳細設定（上級者向け）
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>

            {showAdvanced && (
              <div className="space-y-4 pl-1">
                <p className="text-xs text-muted-foreground">
                  分析品質を向上させるための追加設定です。AIアシストで自動生成することもできます。
                </p>

                {/* 評価フレームワーク */}
                <div className="space-y-2">
                  <Label htmlFor="evaluationFramework">評価フレームワーク</Label>
                  <Input
                    id="evaluationFramework"
                    value={evaluationFramework}
                    onChange={(e) => setEvaluationFramework(e.target.value)}
                    placeholder="例: E-E-A-T + テクニカルSEOチェックリスト"
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    評価に使用するフレームワーク名
                  </p>
                </div>

                {/* スコア基準 */}
                <div className="space-y-2">
                  <Label htmlFor="scoringCriteria">スコア基準</Label>
                  <Textarea
                    id="scoringCriteria"
                    value={scoringCriteria}
                    onChange={(e) => setScoringCriteria(e.target.value)}
                    placeholder="例: 90-100: 優秀な状態 / 70-89: 基本的に良好 / 40-69: 要改善 / 0-39: 深刻な問題あり"
                    rows={3}
                    maxLength={300}
                  />
                  <p className="text-xs text-muted-foreground">
                    {scoringCriteria.length}/300 - 4段階のスコア基準
                  </p>
                </div>

                {/* 評価対象外 */}
                <div className="space-y-2">
                  <Label htmlFor="exclusions">評価対象外</Label>
                  <Textarea
                    id="exclusions"
                    value={exclusions}
                    onChange={(e) => setExclusions(e.target.value)}
                    placeholder="例: コンテンツ文章品質、ビジュアルデザイン、ページ読み込み速度"
                    rows={2}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    {exclusions.length}/200 - 他のペルソナに任せる領域
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
            <Button type="submit">
              {initialData ? '更新' : '作成'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
