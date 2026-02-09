'use client';

import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { usePersonaStore } from '@/stores/persona-store';
import { CATEGORY_CONFIG } from '@/data/default-personas';
import type { PersonaCategory } from '@/types';

export default function PersonasPage() {
  const router = useRouter();
  const personas = usePersonaStore((s) => s.personas);
  const togglePersona = usePersonaStore((s) => s.togglePersona);
  const deletePersona = usePersonaStore((s) => s.deletePersona);

  // カテゴリ別にグループ化
  const grouped = new Map<PersonaCategory, typeof personas>();
  for (const p of personas) {
    const list = grouped.get(p.category) ?? [];
    list.push(p);
    grouped.set(p.category, list);
  }

  const enabledCount = personas.filter((p) => p.enabled).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ペルソナ管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {enabledCount}人の専門家が有効です
          </p>
        </div>
        <Button onClick={() => router.push('/personas/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          ペルソナを追加
        </Button>
      </div>

      {/* カテゴリごとの一覧 */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([category, items]) => {
          const config = CATEGORY_CONFIG[category];
          return (
            <div key={category}>
              <h2
                className="text-sm font-medium mb-3 flex items-center gap-2"
                style={{ color: config?.color }}
              >
                {config?.label || category}
                <Badge variant="secondary" className="text-xs">
                  {items.length}
                </Badge>
              </h2>

              <div className="space-y-2">
                {items.map((persona) => (
                  <Card key={persona.id}>
                    <CardContent className="flex items-center gap-4 py-3 px-4">
                      {/* 有効/無効スイッチ */}
                      <Switch
                        checked={persona.enabled}
                        onCheckedChange={() => togglePersona(persona.id)}
                      />

                      {/* 情報 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{persona.name}</span>
                          {persona.isDefault && (
                            <Badge variant="outline" className="text-xs">
                              デフォルト
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {persona.specialty} - {persona.analysisPoints}
                        </p>
                      </div>

                      {/* アクション（カスタムペルソナのみ） */}
                      {!persona.isDefault && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => router.push(`/personas/${persona.id}/edit`)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              deletePersona(persona.id);
                              toast.success(`${persona.name} を削除しました`);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Separator className="mt-4" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
