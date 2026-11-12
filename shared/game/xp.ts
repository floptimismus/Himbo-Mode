import type { ExerciseMeta, Tracking } from '../data/types.ts';
import {
  CARDIO_XP_PER_MIN, DURATION_BONUS, MAX_CARDIO_MIN, MAX_XP_SETS, PB_MAX_EXERCISES, PB_XP, SET_BASE_XP,
  STREAK_BONUS_MAX_WEEKS, STREAK_BONUS_PER_WEEK, WEEKLY_GOAL_XP, WORKOUT_XP_CAP,
} from './constants.ts';
import { isValidSet } from './pb.ts';
import type { GExercise, GSet, XpBreakdown } from './types.ts';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const isTimeBased = (t: Tracking) => t === 'distance_time' || t === 'duration_rpe';

/** XP for one strength-style set (weight×reps, reps-only or timed hold). */
export function strengthSetXp(tracking: Tracking, s: GSet): number {
  if (!isValidSet(tracking, s)) return 0;
  const effort =
    tracking === 'time' ? clamp((s.durationS ?? 0) / 45, 0.5, 2) : clamp(0.5 + (s.reps ?? 0) / 20, 0.7, 1.4);
  return SET_BASE_XP[s.type] * effort;
}

/** Intensity multiplier from RPE (1–10); 1.0 when no RPE was logged. */
export function intensity(rpe: number | null | undefined): number {
  if (rpe == null) return 1;
  return 0.6 + clamp(rpe, 1, 10) * 0.08;
}

export function durationBonus(durationS: number): number {
  let bonus = 0;
  for (const [minutes, xp] of DURATION_BONUS) if (durationS >= minutes * 60) bonus = xp;
  return bonus;
}

export interface XpInput {
  exercises: GExercise[];
  metaOf: (exerciseId: string) => ExerciseMeta | undefined;
  durationS: number;
  /** Number of exercises with at least one new personal best. */
  pbExercises: number;
  /** This workout completed the weekly goal. */
  goalHitNow: boolean;
  /** Streak (in weeks) before this workout. */
  streakWeeks: number;
}

export function workoutXp(input: XpInput): XpBreakdown {
  let sets = 0;
  let counted = 0;
  let cardioMinutesLeft = Math.min(MAX_CARDIO_MIN, input.durationS / 60);
  let cardio = 0;

  for (const ex of input.exercises) {
    const meta = input.metaOf(ex.exerciseId);
    if (!meta) continue;
    for (const s of ex.sets) {
      if (!isValidSet(meta.tracking, s) || counted >= MAX_XP_SETS) continue;
      counted++;
      if (isTimeBased(meta.tracking)) {
        const minutes = Math.min(cardioMinutesLeft, (s.durationS ?? 0) / 60);
        cardioMinutesLeft -= minutes;
        // A distance without a time still earns a token amount.
        cardio += minutes > 0 ? minutes * CARDIO_XP_PER_MIN * intensity(s.rpe) : (s.durationS ? 0 : SET_BASE_XP.warmup);
      } else {
        sets += strengthSetXp(meta.tracking, s);
      }
    }
  }

  sets = Math.round(sets);
  cardio = Math.round(cardio);
  const streak = Math.round(
    (sets + cardio) * STREAK_BONUS_PER_WEEK * Math.min(Math.max(0, input.streakWeeks), STREAK_BONUS_MAX_WEEKS),
  );
  const pb = PB_XP * Math.min(input.pbExercises, PB_MAX_EXERCISES);
  const duration = counted > 0 ? durationBonus(input.durationS) : 0;
  const weeklyGoal = counted > 0 && input.goalHitNow ? WEEKLY_GOAL_XP : 0;
  const raw = sets + cardio + streak + pb + duration + weeklyGoal;
  const total = Math.min(raw, WORKOUT_XP_CAP);
  return { sets, cardio, streak, pb, duration, weeklyGoal, raw, total, capped: total < raw };
}
