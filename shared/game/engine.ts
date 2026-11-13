import { MUSCLE_GROUPS, type ExerciseMeta, type Muscle } from '../data/types.ts';
import { BIG_THREE, DAILY_XP_CAP, LIMITS, MAX_FREEZES } from './constants.ts';
import { levelForXp } from './levels.ts';
import { exerciseBests, findNewPbs, isValidSet } from './pb.ts';
import { addWeeks, computeStreak, localParts, weekKey } from './streak.ts';
import { evaluateTrophies, TROPHY_BY_ID } from './trophies.ts';
import type { GameState, GExercise, GSet, GWorkout, NewPb, Stats, WorkoutSummary } from './types.ts';
import { isTimeBased, workoutXp } from './xp.ts';

export function emptyStats(): Stats {
  return {
    workouts: 0, sets: 0, reps: 0, volumeKg: 0, pbs: 0, cardioDistanceM: 0, cardioMinutes: 0,
    rugbySessions: 0, rugbyDrillSets: 0, earlyBird: 0, nightOwl: 0, weekend: 0, longestWorkoutMin: 0,
    maxWeightKg: 0, maxRepsInSet: 0, maxMusclesInWorkout: 0, maxWeekWorkouts: 0, bodyweightReps: 0,
    legSets: 0, pushSets: 0, pullSets: 0, coreSets: 0, goalWeeks: 0, comebacks: 0, bestStreak: 0,
    big3: { squat: 0, bench: 0, deadlift: 0 }, exercisesUsed: [], equipmentUsed: [], lastWorkoutAt: 0,
    dayKey: '', dayXp: 0, settledWeek: '', following: 0, routines: 0,
  };
}

export function emptyState(): GameState {
  return { totalXp: 0, freezes: 0, stats: emptyStats(), pbs: {}, weeks: {}, trophies: {} };
}

export type MetaLookup = (exerciseId: string) => ExerciseMeta | undefined;

/** Sets that count: valid for the exercise's tracking type. Unknown exercises are dropped. */
export function validExercises(exercises: GExercise[], metaOf: MetaLookup): GExercise[] {
  const out: GExercise[] = [];
  for (const ex of exercises) {
    const meta = metaOf(ex.exerciseId);
    if (!meta) continue;
    const sets = ex.sets.filter((s) => isValidSet(meta.tracking, s));
    if (sets.length) out.push({ exerciseId: ex.exerciseId, sets });
  }
  return out;
}

/**
 * Training load per muscle: every set gives 1 point to each primary and 0.5 to each secondary
 * muscle (warm-ups count half). Used for the muscle map.
 */
export function muscleLoad(exercises: GExercise[], metaOf: MetaLookup): Partial<Record<Muscle, number>> {
  const load: Partial<Record<Muscle, number>> = {};
  for (const ex of validExercises(exercises, metaOf)) {
    const meta = metaOf(ex.exerciseId)!;
    for (const s of ex.sets) {
      const w = s.type === 'warmup' ? 0.5 : 1;
      for (const m of meta.primary) load[m] = (load[m] ?? 0) + w;
      for (const m of meta.secondary) load[m] = (load[m] ?? 0) + w * 0.5;
    }
  }
  return load;
}

export interface WorkoutTotals {
  volumeKg: number;
  sets: number;
  reps: number;
  distanceM: number;
}

export function workoutTotals(exercises: GExercise[], metaOf: MetaLookup): WorkoutTotals {
  const t: WorkoutTotals = { volumeKg: 0, sets: 0, reps: 0, distanceM: 0 };
  for (const ex of validExercises(exercises, metaOf)) {
    const meta = metaOf(ex.exerciseId)!;
    for (const s of ex.sets) {
      t.sets++;
      if (meta.tracking === 'weight_reps' || meta.tracking === 'reps') t.reps += s.reps ?? 0;
      if (meta.tracking === 'weight_reps' && s.type !== 'warmup') t.volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
      if (meta.tracking === 'distance_time') t.distanceM += s.distanceM ?? 0;
    }
  }
  t.volumeKg = Math.round(t.volumeKg * 100) / 100;
  return t;
}

const inGroup = (meta: ExerciseMeta, group: readonly Muscle[]) => meta.primary.some((m) => group.includes(m));
const addUnique = (list: string[], v: string) => {
  if (!list.includes(v)) list.push(v);
};

/** Re-evaluate trophies after any state change; grants streak freezes for silver/gold tiers. */
export function awardTrophies(state: GameState, at: number, workoutId: string | null): Array<{ id: string; tier: number }> {
  const unlocked: Array<{ id: string; tier: number }> = [];
  // Loop because an unlock can change nothing else today, but stays correct if trophies ever feed metrics.
  for (const u of evaluateTrophies(state, state.trophies)) {
    const def = TROPHY_BY_ID.get(u.id)!;
    const before = state.trophies[u.id]?.tier ?? 0;
    state.trophies[u.id] = { tier: u.tier, at, workoutId };
    unlocked.push(u);
    if (def.tiers.length > 1) {
      for (let tier = before + 1; tier <= u.tier; tier++) {
        if (tier >= 2) state.freezes = Math.min(MAX_FREEZES, state.freezes + 1);
      }
    }
  }
  return unlocked;
}

export interface ProcessContext {
  metaOf: MetaLookup;
  /** The player's weekly goal at the time the workout is processed. */
  weeklyGoal: number;
}

/**
 * Apply one finished workout to a player's game state. Pure: returns a new state plus the summary
 * shown after the workout. Workouts must be applied in chronological order (the server replays
 * the full history whenever a workout is edited, deleted or arrives out of order).
 */
export function processWorkout(prev: GameState, workout: GWorkout, ctx: ProcessContext): { state: GameState; summary: WorkoutSummary } {
  const state: GameState = structuredClone(prev);
  const { stats } = state;
  const exercises = validExercises(workout.exercises, ctx.metaOf);
  const counts = exercises.length > 0;
  const durationS = Math.max(0, Math.min(LIMITS.workoutDurationS, Math.round((workout.endedAt - workout.startedAt) / 1000)));
  const levelBefore = levelForXp(state.totalXp);
  const local = localParts(workout.startedAt, workout.tzOffsetMin);
  const week = weekKey(workout.startedAt, workout.tzOffsetMin);

  // ── Streak before this workout; settle missed weeks (may consume freezes) ──
  const before = computeStreak(state.weeks, week, state.freezes, stats.settledWeek);
  for (const w of before.newlyFrozen) state.weeks[w] = { workouts: state.weeks[w]?.workouts ?? 0, xp: state.weeks[w]?.xp ?? 0, goal: state.weeks[w]?.goal ?? ctx.weeklyGoal, frozen: true };
  state.freezes = before.freezes;
  const lastWeek = addWeeks(week, -1);
  if (lastWeek > stats.settledWeek) stats.settledWeek = lastWeek;

  // ── Personal bests (sets of the same exercise are merged across blocks) ──
  const byExercise = new Map<string, GSet[]>();
  for (const ex of exercises) byExercise.set(ex.exerciseId, [...(byExercise.get(ex.exerciseId) ?? []), ...ex.sets]);
  const pbs: NewPb[] = [];
  let pbExercises = 0;
  for (const [exerciseId, sets] of byExercise) {
    const meta = ctx.metaOf(exerciseId)!;
    const bests = exerciseBests(meta.tracking, sets);
    const fresh = findNewPbs(exerciseId, bests, state.pbs[exerciseId]);
    if (fresh.length) {
      pbExercises++;
      pbs.push(...fresh);
      const rec = (state.pbs[exerciseId] ??= {});
      for (const p of fresh) rec[p.kind] = p.value;
    }
    if (bests.e1rm) {
      if (exerciseId === BIG_THREE.squat) stats.big3.squat = Math.max(stats.big3.squat, bests.e1rm);
      if (exerciseId === BIG_THREE.bench) stats.big3.bench = Math.max(stats.big3.bench, bests.e1rm);
      if (exerciseId === BIG_THREE.deadlift) stats.big3.deadlift = Math.max(stats.big3.deadlift, bests.e1rm);
    }
  }

  // ── Weekly goal ──
  const wk = (state.weeks[week] ??= { workouts: 0, xp: 0, goal: ctx.weeklyGoal });
  wk.goal = ctx.weeklyGoal;
  const metBefore = wk.workouts >= wk.goal;
  if (counts) wk.workouts++;
  const goalHitNow = !metBefore && wk.workouts >= wk.goal;
  if (goalHitNow) stats.goalWeeks++;

  // ── XP ──
  const xp = workoutXp({ exercises, metaOf: ctx.metaOf, durationS, pbExercises, goalHitNow, streakWeeks: before.streak });
  if (stats.dayKey !== local.dateKey) {
    stats.dayKey = local.dateKey;
    stats.dayXp = 0;
  }
  const allowed = Math.max(0, DAILY_XP_CAP - stats.dayXp);
  if (xp.total > allowed) {
    xp.total = allowed;
    xp.capped = true;
  }
  stats.dayXp += xp.total;
  state.totalXp += xp.total;
  wk.xp += xp.total;

  // ── Lifetime counters ──
  const totals = workoutTotals(exercises, ctx.metaOf);
  const muscles = muscleLoad(exercises, ctx.metaOf);
  if (counts) {
    if (stats.workouts > 0 && workout.startedAt - stats.lastWorkoutAt >= 14 * 86_400_000) stats.comebacks++;
    stats.workouts++;
    stats.lastWorkoutAt = Math.max(stats.lastWorkoutAt, workout.startedAt);
    if (local.hour < 7) stats.earlyBird++;
    if (local.hour >= 21) stats.nightOwl++;
    if (local.weekday >= 5) stats.weekend++;
    stats.longestWorkoutMin = Math.max(stats.longestWorkoutMin, durationS / 60);
    stats.maxWeekWorkouts = Math.max(stats.maxWeekWorkouts, wk.workouts);
    // Variety counts muscles that were a primary target of at least one exercise.
    const primaries = new Set(exercises.flatMap((ex) => ctx.metaOf(ex.exerciseId)!.primary));
    stats.maxMusclesInWorkout = Math.max(stats.maxMusclesInWorkout, primaries.size);
  }
  stats.sets += totals.sets;
  stats.reps += totals.reps;
  stats.volumeKg += totals.volumeKg;
  stats.pbs += pbs.length;
  let rugby = false;
  for (const ex of exercises) {
    const meta = ctx.metaOf(ex.exerciseId)!;
    addUnique(stats.exercisesUsed, meta.id);
    addUnique(stats.equipmentUsed, meta.equipment);
    if (meta.category === 'rugby') {
      rugby = true;
      stats.rugbyDrillSets += ex.sets.length;
    }
    for (const s of ex.sets) {
      if (isTimeBased(meta.tracking)) {
        stats.cardioMinutes += (s.durationS ?? 0) / 60;
        if (meta.tracking === 'distance_time') stats.cardioDistanceM += s.distanceM ?? 0;
        continue;
      }
      if (meta.tracking === 'weight_reps') stats.maxWeightKg = Math.max(stats.maxWeightKg, s.weightKg ?? 0);
      if (meta.tracking !== 'time') stats.maxRepsInSet = Math.max(stats.maxRepsInSet, s.reps ?? 0);
      if (meta.equipment === 'bodyweight') stats.bodyweightReps += s.reps ?? 0;
      if (meta.category !== 'strength') continue;
      if (inGroup(meta, MUSCLE_GROUPS.legs)) stats.legSets++;
      if (inGroup(meta, MUSCLE_GROUPS.push)) stats.pushSets++;
      if (inGroup(meta, MUSCLE_GROUPS.pull)) stats.pullSets++;
      if (inGroup(meta, MUSCLE_GROUPS.core)) stats.coreSets++;
    }
  }
  if (rugby) stats.rugbySessions++;

  // ── Streak after, trophies ──
  const after = computeStreak(state.weeks, week, state.freezes, stats.settledWeek);
  stats.bestStreak = Math.max(stats.bestStreak, after.best);
  const trophies = awardTrophies(state, workout.endedAt, workout.id);

  return {
    state,
    summary: {
      workoutId: workout.id,
      durationS,
      ...totals,
      xp,
      totalXp: state.totalXp,
      levelBefore,
      levelAfter: levelForXp(state.totalXp),
      pbs,
      trophies,
      streak: { before: before.streak, after: after.streak, weekWorkouts: wk.workouts, goal: wk.goal, goalHitNow, freezes: state.freezes },
      muscles,
    },
  };
}

/**
 * Replay a full history from scratch. `seed` carries the non-workout counters (following,
 * routines); `goalForWeek` lets the caller keep the weekly goal that applied back then.
 */
export function replay(workouts: GWorkout[], ctx: ProcessContext, seed?: Partial<Stats>, goalForWeek?: (week: string) => number | undefined) {
  let state = emptyState();
  Object.assign(state.stats, seed);
  const summaries = new Map<string, WorkoutSummary>();
  for (const w of [...workouts].sort((a, b) => a.startedAt - b.startedAt)) {
    const weeklyGoal = goalForWeek?.(weekKey(w.startedAt, w.tzOffsetMin)) ?? ctx.weeklyGoal;
    const r = processWorkout(state, w, { ...ctx, weeklyGoal });
    state = r.state;
    summaries.set(w.id, r.summary);
  }
  return { state, summaries };
}
