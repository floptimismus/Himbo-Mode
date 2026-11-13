import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkoutSummary } from '@shared/game/types.ts';
import type { WorkoutInput } from '@shared/schemas.ts';

interface OutboxState {
  /** Finished workouts not yet accepted by the server, oldest first. */
  pending: WorkoutInput[];
  /** Workouts the server rejected for good (kept so nothing is silently lost). */
  failed: WorkoutInput[];
  /** Recently finished workouts and their server summaries, for the summary screen. */
  recent: Record<string, { input: WorkoutInput; summary: WorkoutSummary | null }>;
  enqueue: (input: WorkoutInput) => void;
  markSynced: (id: string, summary: WorkoutSummary) => void;
  markFailed: (id: string) => void;
  clear: () => void;
}

const KEEP_RECENT = 5;

export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      pending: [],
      failed: [],
      recent: {},
      enqueue: (input) =>
        set((s) => {
          const recent = { ...s.recent, [input.id]: { input, summary: null } };
          const ids = Object.keys(recent);
          for (const id of ids.slice(0, Math.max(0, ids.length - KEEP_RECENT))) {
            if (!s.pending.some((p) => p.id === id)) delete recent[id];
          }
          return { pending: [...s.pending, input], recent };
        }),
      markSynced: (id, summary) =>
        set((s) => ({
          pending: s.pending.filter((p) => p.id !== id),
          recent: s.recent[id] ? { ...s.recent, [id]: { ...s.recent[id], summary } } : s.recent,
        })),
      markFailed: (id) =>
        set((s) => {
          const item = s.pending.find((p) => p.id === id);
          return { pending: s.pending.filter((p) => p.id !== id), failed: item ? [...s.failed, item] : s.failed };
        }),
      clear: () => set({ pending: [], failed: [], recent: {} }),
    }),
    { name: 'himbo-outbox' },
  ),
);
