/**
 * Himbo-Mode game rules – every tunable number lives here.
 *
 * ── XP formula (per workout) ────────────────────────────────────────────────
 *   sets     Σ over completed strength sets (weight×reps, reps-only, timed holds):
 *              SET_BASE_XP[type] × effort
 *              effort (reps)  = clamp(0.5 + reps / 20, 0.7, 1.4)   → 10 reps = 1.0
 *              effort (holds) = clamp(seconds / 45, 0.5, 2.0)      → 45 s    = 1.0
 *            Only the first MAX_XP_SETS sets count.
 *   cardio   Σ over cardio/rugby sets (distance+time, duration+RPE):
 *              minutes × CARDIO_XP_PER_MIN × intensity
 *              intensity = 0.6 + RPE × 0.08 (RPE 5 = 1.0, RPE 10 = 1.4); 1.0 without RPE
 *            Counted minutes are capped by the workout's wall-clock duration and
 *            MAX_CARDIO_MIN, so you cannot log more cardio than time has passed.
 *   streak   (sets + cardio) × STREAK_BONUS_PER_WEEK × min(streak weeks, STREAK_BONUS_MAX_WEEKS)
 *   pb       PB_XP × min(exercises with ≥1 new personal best, PB_MAX_EXERCISES)
 *   duration DURATION_BONUS tier reached by the workout duration (needs ≥1 counted set)
 *   goal     WEEKLY_GOAL_XP once, on the workout that completes the weekly goal
 *
 *   total = min(sum, WORKOUT_XP_CAP), then limited by DAILY_XP_CAP per local day.
 *
 * Fairness check: ~20 working sets in 60 min ≈ 200 + 20 = 220 XP;
 * 60 min steady cardio at RPE 6 ≈ 60 × 2.5 × 1.08 + 20 = 182 XP;
 * 80 min rugby session at RPE 8 ≈ 80 × 2.5 × 1.24 + 30 = 278 XP.
 */
import type { SetType } from './types.ts';

export const SET_BASE_XP: Record<SetType, number> = { normal: 10, warmup: 4, drop: 8, failure: 12 };
export const MAX_XP_SETS = 60;
export const CARDIO_XP_PER_MIN = 2.5;
export const MAX_CARDIO_MIN = 180;
export const PB_XP = 20;
export const PB_MAX_EXERCISES = 5;
/** [minimum minutes, bonus XP], highest reached tier wins. */
export const DURATION_BONUS: ReadonlyArray<readonly [number, number]> = [[20, 10], [45, 20], [75, 30]];
export const WEEKLY_GOAL_XP = 50;
export const STREAK_BONUS_PER_WEEK = 0.02;
export const STREAK_BONUS_MAX_WEEKS = 10;
export const WORKOUT_XP_CAP = 600;
export const DAILY_XP_CAP = 1500;

/** Estimated 1RM (Epley) is only trusted up to this many reps. */
export const E1RM_MAX_REPS = 12;
/** Pace records need at least this distance. */
export const PACE_MIN_DISTANCE_M = 1000;

/**
 * Levels: total XP needed to reach level L = round10(LEVEL_BASE × (L − 1)^LEVEL_EXP).
 * L2 = 100, L10 ≈ 3 360, L20 ≈ 11 120, L50 ≈ 50 600, L90 ≈ 131 500.
 */
export const LEVEL_BASE = 100;
export const LEVEL_EXP = 1.6;
export const MAX_LEVEL = 99;

/** Weekly goal bounds and streak freezes. */
export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 7;
export const WEEKLY_GOAL_DEFAULT = 3;
/** A freeze is earned for every silver or gold trophy tier; at most this many can be banked. */
export const MAX_FREEZES = 2;

/** Plausibility caps enforced by the API so leaderboards cannot be trivially gamed. */
export const LIMITS = {
  weightKg: 600,
  reps: 500,
  setDurationS: 6 * 3600,
  distanceM: 300_000,
  setsPerExercise: 30,
  exercisesPerWorkout: 40,
  workoutDurationS: 12 * 3600,
  nameLength: 60,
  notesLength: 500,
  routines: 100,
  customExercises: 200,
} as const;

/** Exercise ids used by the "Big Three" trophy. */
export const BIG_THREE = {
  squat: 'barbell-back-squat',
  bench: 'barbell-bench-press',
  deadlift: 'barbell-deadlift',
} as const;
