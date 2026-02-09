'use client';

import { useState } from 'react';
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
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-5 pt-6">
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
