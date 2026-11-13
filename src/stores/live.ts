import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SetType } from '@shared/game/types.ts';

export interface LiveSet {
  uid: string;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  rpe: number | null;
  done: boolean;
}

export interface LiveExercise {
  uid: string;
  exerciseId: string;
  notes: string;
  sets: LiveSet[];
}

export interface LiveWorkout {
  id: string;
  name: string;
  /** Wall-clock start; the timer is always derived from this, never counted. */
  startedAt: number;
  routineId: string | null;
  exercises: LiveExercise[];
}

interface LiveState {
  active: LiveWorkout | null;
  rest: { endsAt: number; total: number } | null;
  start: (name: string, exercises?: LiveExercise[], routineId?: string | null) => void;
  setName: (name: string) => void;
  setExercises: (update: (prev: LiveExercise[]) => LiveExercise[]) => void;
  startRest: (seconds: number) => void;
  addRest: (seconds: number) => void;
  clearRest: () => void;
  discard: () => void;
}

/**
 * The in-progress workout. Persisted to localStorage on every change, so it survives reloads,
 * backgrounding, crashes and being offline.
 */
export const useLive = create<LiveState>()(
  persist(
    (set) => ({
      active: null,
      rest: null,
      start: (name, exercises = [], routineId = null) =>
        set({ active: { id: crypto.randomUUID(), name, startedAt: Date.now(), routineId, exercises }, rest: null }),
      setName: (name) => set((s) => (s.active ? { active: { ...s.active, name } } : s)),
      setExercises: (update) => set((s) => (s.active ? { active: { ...s.active, exercises: update(s.active.exercises) } } : s)),
      startRest: (seconds) => set({ rest: { endsAt: Date.now() + seconds * 1000, total: seconds } }),
      addRest: (seconds) => set((s) => (s.rest ? { rest: { endsAt: s.rest.endsAt + seconds * 1000, total: s.rest.total + seconds } } : s)),
      clearRest: () => set({ rest: null }),
      discard: () => set({ active: null, rest: null }),
    }),
    { name: 'himbo-live' },
  ),
);
