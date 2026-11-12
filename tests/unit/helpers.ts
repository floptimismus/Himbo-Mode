import { systemMeta } from '../../shared/data/exercises/index.ts';
import type { ProcessContext } from '../../shared/game/engine.ts';
import type { GSet, GWorkout } from '../../shared/game/types.ts';

export const ctx: ProcessContext = { metaOf: systemMeta, weeklyGoal: 3 };

/** 2026-01-05 is a Monday. */
export const MON = Date.UTC(2026, 0, 5, 12, 0, 0);
export const DAY = 86_400_000;
export const MIN = 60_000;

export const set = (weightKg: number, reps: number, type: GSet['type'] = 'normal'): GSet => ({ type, weightKg, reps });

let n = 0;
export function workout(startedAt: number, exercises: GWorkout['exercises'], minutes = 60): GWorkout {
  return { id: `w${++n}`, startedAt, endedAt: startedAt + minutes * MIN, tzOffsetMin: 0, exercises };
}

export const bench = (sets: GSet[]) => ({ exerciseId: 'barbell-bench-press', sets });
export const simple = (startedAt: number) => workout(startedAt, [bench([set(60, 10), set(60, 10), set(60, 10)])]);
