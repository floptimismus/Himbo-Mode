import { z } from 'zod';
import { EQUIPMENT, MUSCLES, TRACKING } from './data/types.ts';
import { LIMITS, WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from './game/constants.ts';

const num = (max: number) => z.number().finite().min(0).max(max).nullish();

export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{3,20}$/, 'Username: 3-20 characters, letters, digits and underscore only');

export const displayNameSchema = z.string().trim().max(40);

export const setSchema = z.object({
  type: z.enum(['normal', 'warmup', 'drop', 'failure']),
  weightKg: num(LIMITS.weightKg),
  reps: z.number().int().min(0).max(LIMITS.reps).nullish(),
  durationS: num(LIMITS.setDurationS),
  distanceM: num(LIMITS.distanceM),
  rpe: z.number().min(1).max(10).nullish(),
});
export type SetInput = z.infer<typeof setSchema>;

export const workoutExerciseSchema = z.object({
  exerciseId: z.string().min(1).max(80),
  notes: z.string().max(LIMITS.notesLength).nullish(),
  sets: z.array(setSchema).max(LIMITS.setsPerExercise),
});

export const workoutSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(LIMITS.nameLength),
  startedAt: z.number().int().positive(),
  endedAt: z.number().int().positive(),
  tzOffsetMin: z.number().int().min(-720).max(840),
  notes: z.string().max(LIMITS.notesLength).nullish(),
  routineId: z.string().max(80).nullish(),
  exercises: z.array(workoutExerciseSchema).max(LIMITS.exercisesPerWorkout),
});
export type WorkoutInput = z.infer<typeof workoutSchema>;

/** Editing keeps the original time span; only content can change. */
export const workoutEditSchema = workoutSchema.pick({ name: true, notes: true, exercises: true });
export type WorkoutEdit = z.infer<typeof workoutEditSchema>;

export const routineSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameLength),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().min(1).max(80),
        targetSets: z.number().int().min(1).max(LIMITS.setsPerExercise),
        targetReps: z.number().int().min(1).max(LIMITS.reps).nullish(),
        targetWeightKg: num(LIMITS.weightKg),
        notes: z.string().max(LIMITS.notesLength).nullish(),
      }),
    )
    .max(LIMITS.exercisesPerWorkout),
});
export type RoutineInput = z.infer<typeof routineSchema>;

export const customExerciseSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameLength),
  primary: z.array(z.enum(MUSCLES)).max(6),
  secondary: z.array(z.enum(MUSCLES)).max(10),
  equipment: z.enum(EQUIPMENT),
  tracking: z.enum(TRACKING),
});
export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;

export const settingsSchema = z
  .object({
    displayName: displayNameSchema.nullable(),
    avatar: z.string().regex(/^a([1-9]|1[0-2])$/),
    locale: z.enum(['en', 'de']),
    theme: z.enum(['light', 'dark', 'system']),
    units: z.enum(['kg', 'lb']),
    weeklyGoal: z.number().int().min(WEEKLY_GOAL_MIN).max(WEEKLY_GOAL_MAX),
    leaderboardVisible: z.boolean(),
    workoutsPublic: z.boolean(),
  })
  .partial();
export type SettingsInput = z.infer<typeof settingsSchema>;
