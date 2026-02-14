import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '@/types';

const MAX_CHATS = 50; // 最大保持チャット数（分析ID:ペルソナID の組み合わせ）

interface ChatStore {
  chats: Record<string, ChatMessage[]>;
  getMessages: (analysisId: string, personaId: string) => ChatMessage[];
  addMessage: (analysisId: string, personaId: string, message: ChatMessage) => void;
  clearChat: (analysisId: string, personaId: string) => void;
}

function chatKey(analysisId: string, personaId: string): string {
  return `${analysisId}:${personaId}`;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: {},

      getMessages: (analysisId, personaId) => {
        return get().chats[chatKey(analysisId, personaId)] ?? [];
      },

      addMessage: (analysisId, personaId, message) =>
        set((state) => {
          const key = chatKey(analysisId, personaId);
          const existing = state.chats[key] ?? [];
          const updated = { ...state.chats, [key]: [...existing, message] };

          // 最大保持数を超えた場合、古いチャットから削除
          const keys = Object.keys(updated);
          if (keys.length > MAX_CHATS) {
            const toRemove = keys.slice(0, keys.length - MAX_CHATS);
            for (const k of toRemove) {
              delete updated[k];
            }
          }

          return { chats: updated };
        }),

      clearChat: (analysisId, personaId) =>
        set((state) => {
          const key = chatKey(analysisId, personaId);
          const updated = { ...state.chats };
          delete updated[key];
          return { chats: updated };
        }),
    }),
    {
      name: 'siteprobe-chats',
    }
  )
);
