'use client';

import { useRouter, useParams } from 'next/navigation';
import { PersonaForm } from '@/components/personas/persona-form';
import { usePersonaStore } from '@/stores/persona-store';
import { toast } from 'sonner';
import type { Persona } from '@/types';

export default function EditPersonaPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const personas = usePersonaStore((s) => s.personas);
  const updatePersona = usePersonaStore((s) => s.updatePersona);

  const persona = personas.find((p) => p.id === id);

  if (!persona) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">ペルソナが見つかりません</p>
      </div>
    );
  }

  if (persona.isDefault) {
    router.push('/personas');
    return null;
  }

  const handleSubmit = (data: Omit<Persona, 'id' | 'isDefault' | 'enabled'>) => {
    updatePersona(id, data);
    toast.success(`${data.name} を更新しました`);
    router.push('/personas');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ペルソナを編集</h1>
      <PersonaForm
        initialData={persona}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/personas')}
      />
    </div>
  );
}
