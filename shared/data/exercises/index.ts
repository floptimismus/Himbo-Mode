import type { Exercise, ExerciseMeta } from '../types.ts';
import { BODYWEIGHT } from './bodyweight.ts';
import { CARDIO, RUGBY } from './cardio-rugby.ts';
import { BARBELL, DUMBBELL } from './free-weights.ts';
import { BAND, CABLE, KETTLEBELL, MACHINE } from './gym.ts';

/** The built-in exercise library. Ids are stable – never rename an id that has shipped. */
export const EXERCISES: readonly Exercise[] = [
  ...BARBELL, ...DUMBBELL, ...KETTLEBELL, ...BAND, ...CABLE, ...MACHINE, ...BODYWEIGHT, ...CARDIO, ...RUGBY,
];

export const EXERCISE_BY_ID: ReadonlyMap<string, Exercise> = new Map(EXERCISES.map((x) => [x.id, x]));

export const systemMeta = (id: string): ExerciseMeta | undefined => EXERCISE_BY_ID.get(id);
