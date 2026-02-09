'use client';

import { useRouter } from 'next/navigation';
import { PersonaForm } from '@/components/personas/persona-form';
import { usePersonaStore } from '@/stores/persona-store';
import { toast } from 'sonner';
import type { Persona } from '@/types';

export default function NewPersonaPage() {
  const router = useRouter();
  const addPersona = usePersonaStore((s) => s.addPersona);

  const handleSubmit = (data: Omit<Persona, 'id' | 'isDefault' | 'enabled'>) => {
    const persona: Persona = {
      ...data,
      id: `custom-${Date.now()}`,
      isDefault: false,
      enabled: true,
    };
    addPersona(persona);
    toast.success(`${persona.name} を追加しました`);
    router.push('/personas');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">新しいペルソナを作成</h1>
      <PersonaForm onSubmit={handleSubmit} onCancel={() => router.push('/personas')} />
    </div>
  );
}
