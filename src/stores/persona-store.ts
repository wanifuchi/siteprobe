import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Persona } from '@/types';
import { DEFAULT_PERSONAS } from '@/data/default-personas';

interface PersonaStore {
  personas: Persona[];
  addPersona: (persona: Persona) => void;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  deletePersona: (id: string) => void;
  togglePersona: (id: string) => void;
  getEnabledPersonas: () => Persona[];
}

export const usePersonaStore = create<PersonaStore>()(
  persist(
    (set, get) => ({
      personas: DEFAULT_PERSONAS,

      // カスタムペルソナを追加
      addPersona: (persona) =>
        set((state) => ({
          personas: [...state.personas, { ...persona, isDefault: false }],
        })),

      // ペルソナを更新（デフォルトペルソナは enabled のみ変更可能）
      updatePersona: (id, updates) =>
        set((state) => ({
          personas: state.personas.map((p) => {
            if (p.id !== id) return p;
            if (p.isDefault) {
              // デフォルトペルソナは enabled の切り替えのみ許可
              return updates.enabled !== undefined
                ? { ...p, enabled: updates.enabled }
                : p;
            }
            return { ...p, ...updates };
          }),
        })),

      // カスタムペルソナのみ削除可能
      deletePersona: (id) =>
        set((state) => ({
          personas: state.personas.filter(
            (p) => p.id !== id || p.isDefault
          ),
        })),

      // ペルソナの有効/無効を切り替え
      togglePersona: (id) =>
        set((state) => ({
          personas: state.personas.map((p) =>
            p.id === id ? { ...p, enabled: !p.enabled } : p
          ),
        })),

      // 有効なペルソナの一覧を取得
      getEnabledPersonas: () =>
        get().personas.filter((p) => p.enabled),
    }),
    {
      name: 'siteprobe-personas',
      // デフォルトペルソナが追加された場合にマージする
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<PersonaStore> | undefined;
        if (!persistedState?.personas) return current;

        const persistedIds = new Set(persistedState.personas.map((p) => p.id));
        // 新しく追加されたデフォルトペルソナをマージ
        const newDefaults = current.personas.filter(
          (p) => p.isDefault && !persistedIds.has(p.id)
        );

        return {
          ...current,
          personas: [...persistedState.personas, ...newDefaults],
        };
      },
    }
  )
);
