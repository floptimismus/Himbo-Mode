import type { LastPerformance, RoutineExercise, WorkoutDetail } from '@shared/api.ts';
import type { Exercise, Tracking } from '@shared/data/types.ts';
import { isValidSet } from '@shared/game/pb.ts';
import type { GExercise } from '@shared/game/types.ts';
import { isTimeBased } from '@shared/game/xp.ts';
import type { RoutineInput, WorkoutInput } from '@shared/schemas.ts';
import type { T } from '@/i18n/index.ts';
import type { LiveExercise, LiveSet, LiveWorkout } from '@/stores/live.ts';

const uid = () => crypto.randomUUID();

export function newSet(from?: Partial<LiveSet>): LiveSet {
  return { type: 'normal', weightKg: null, reps: null, durationS: null, distanceM: null, rpe: null, ...from, uid: uid(), done: from?.done ?? false };
}

/**
 * A fresh exercise block. Sets are pre-filled from the routine target if there is one,
 * otherwise from the last time this exercise was performed, otherwise left empty.
 */
export function blockFor(exercise: Exercise, last?: LastPerformance, target?: RoutineExercise): LiveExercise {
  let sets: LiveSet[];
  if (target) {
    sets = Array.from({ length: target.targetSets }, (_, i) => {
      const prev = last?.sets[i] ?? last?.sets.at(-1);
      return newSet({ ...prev, type: prev?.type ?? 'normal', reps: target.targetReps ?? prev?.reps ?? null, weightKg: target.targetWeightKg ?? prev?.weightKg ?? null });
    });
  } else if (last?.sets.length) {
    sets = last.sets.map((s) => newSet({ type: s.type, weightKg: s.weightKg ?? null, reps: s.reps ?? null, durationS: s.durationS ?? null, distanceM: s.distanceM ?? null, rpe: s.rpe ?? null }));
  } else {
    sets = Array.from({ length: isTimeBased(exercise.tracking) ? 1 : 3 }, () => newSet());
  }
  return { uid: uid(), exerciseId: exercise.id, notes: target?.notes ?? '', sets };
}

export function setsFromDetail(detail: WorkoutDetail): LiveExercise[] {
  return detail.exercises.map((ex) => ({
    uid: uid(),
    exerciseId: ex.exerciseId,
    notes: ex.notes ?? '',
    sets: ex.sets.map((s) => newSet({ type: s.type, weightKg: s.weightKg ?? null, reps: s.reps ?? null, durationS: s.durationS ?? null, distanceM: s.distanceM ?? null, rpe: s.rpe ?? null, done: true })),
  }));
}

export function countSets(exercises: LiveExercise[]) {
  let done = 0;
  let undone = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.done) done++;
      else undone++;
    }
  }
  return { done, undone };
}

const cleanSet = (s: LiveSet) => ({ type: s.type, weightKg: s.weightKg, reps: s.reps, durationS: s.durationS, distanceM: s.distanceM, rpe: s.rpe });

/** Only completed sets are sent; exercises without any are dropped. */
export function toExercisesInput(exercises: LiveExercise[]): WorkoutInput['exercises'] {
  return exercises
    .map((ex) => ({ exerciseId: ex.exerciseId, notes: ex.notes.trim() || null, sets: ex.sets.filter((s) => s.done).map(cleanSet) }))
    .filter((ex) => ex.sets.length > 0);
}

export function toWorkoutInput(live: LiveWorkout, endedAt: number, fallbackName: string): WorkoutInput {
  return {
    id: live.id,
    name: live.name.trim() || fallbackName,
    startedAt: live.startedAt,
    endedAt,
    tzOffsetMin: -new Date().getTimezoneOffset(),
    routineId: live.routineId,
    exercises: toExercisesInput(live.exercises),
  };
}

export const toGame = (exercises: WorkoutInput['exercises']): GExercise[] => exercises.map((ex) => ({ exerciseId: ex.exerciseId, sets: ex.sets }));

/** Routine built from a finished workout: set count, plus reps and weight of the first working set. */
export function routineFromWorkout(name: string, exercises: WorkoutInput['exercises'], trackingOf: (id: string) => Tracking | undefined): RoutineInput {
  return {
    name,
    exercises: exercises.map((ex) => {
      const working = ex.sets.find((s) => s.type !== 'warmup') ?? ex.sets[0];
      const strength = trackingOf(ex.exerciseId) === 'weight_reps';
      return {
        exerciseId: ex.exerciseId,
        targetSets: Math.max(1, ex.sets.length),
        targetReps: working?.reps || null,
        targetWeightKg: strength ? (working?.weightKg ?? null) : null,
        notes: ex.notes ?? null,
      };
    }),
  };
}

export function defaultWorkoutName(t: T['t']): string {
  const h = new Date().getHours();
  return t(h < 11 ? 'workout.defaultName.morning' : h >= 17 ? 'workout.defaultName.evening' : 'workout.defaultName.day');
}

export const setIsValid = (tracking: Tracking, s: LiveSet) => isValidSet(tracking, s);
