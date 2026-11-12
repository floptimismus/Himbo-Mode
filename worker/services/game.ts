import { systemMeta } from '../../shared/data/exercises/index.ts';
import type { ExerciseMeta } from '../../shared/data/types.ts';
import { awardTrophies, emptyState, emptyStats, processWorkout, replay, type MetaLookup } from '../../shared/game/engine.ts';
import { levelForXp } from '../../shared/game/levels.ts';
import { computeStreak } from '../../shared/game/streak.ts';
import type { GameState, GWorkout, PbKind, SetType, Stats, WorkoutSummary } from '../../shared/game/types.ts';
import { now, parseJson, runBatches, uid } from '../lib/util.ts';

interface PbRow {
  exerciseId: string;
  kind: PbKind;
  value: number;
  workoutId: string | null;
  at: number;
}

/** System exercises plus the user's own custom ones. */
export async function loadMeta(db: D1Database, userId: string): Promise<MetaLookup> {
  const rows = await db
    .prepare('SELECT id, primary_muscles, secondary_muscles, equipment, tracking, category FROM exercises WHERE owner_id = ?')
    .bind(userId)
    .all<{ id: string; primary_muscles: string; secondary_muscles: string; equipment: string; tracking: string; category: string }>();
  const custom = new Map<string, ExerciseMeta>(
    rows.results.map((r) => [
      r.id,
      {
        id: r.id,
        primary: parseJson(r.primary_muscles, []),
        secondary: parseJson(r.secondary_muscles, []),
        equipment: r.equipment as ExerciseMeta['equipment'],
        tracking: r.tracking as ExerciseMeta['tracking'],
        category: r.category as ExerciseMeta['category'],
      },
    ]),
  );
  return (id) => systemMeta(id) ?? custom.get(id);
}

export async function loadState(db: D1Database, userId: string): Promise<{ state: GameState; weeklyGoal: number }> {
  const [user, pbs, weeks, trophies] = await db.batch([
    db.prepare('SELECT total_xp, streak_freezes, stats_json, weekly_goal FROM users WHERE id = ?').bind(userId),
    db.prepare('SELECT exercise_id, kind, value FROM personal_bests WHERE user_id = ?').bind(userId),
    db.prepare('SELECT week, workouts, xp, goal, frozen FROM weekly_stats WHERE user_id = ?').bind(userId),
    db.prepare('SELECT trophy_id, tier, unlocked_at, workout_id FROM user_trophies WHERE user_id = ?').bind(userId),
  ]);
  const u = user!.results[0] as { total_xp: number; streak_freezes: number; stats_json: string; weekly_goal: number };
  const state = emptyState();
  state.totalXp = u.total_xp;
  state.freezes = u.streak_freezes;
  const stored = parseJson<Partial<Stats>>(u.stats_json, {});
  state.stats = { ...emptyStats(), ...stored, big3: { ...emptyStats().big3, ...stored.big3 } };
  for (const r of pbs!.results as Array<{ exercise_id: string; kind: PbKind; value: number }>) (state.pbs[r.exercise_id] ??= {})[r.kind] = r.value;
  for (const r of weeks!.results as Array<{ week: string; workouts: number; xp: number; goal: number; frozen: number }>) {
    state.weeks[r.week] = { workouts: r.workouts, xp: r.xp, goal: r.goal, ...(r.frozen ? { frozen: true } : {}) };
  }
  for (const r of trophies!.results as Array<{ trophy_id: string; tier: number; unlocked_at: number; workout_id: string | null }>) {
    state.trophies[r.trophy_id] = { tier: r.tier, at: r.unlocked_at, workoutId: r.workout_id };
  }
  return { state, weeklyGoal: u.weekly_goal };
}

/** Statements that bring the stored game state from `prev` to `next`. */
function stateStatements(db: D1Database, userId: string, prev: GameState, next: GameState, pbRows: PbRow[]): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = [];
  const lastWeek = Object.keys(next.weeks).filter((k) => next.weeks[k]!.workouts > 0).sort().at(-1) ?? null;
  const streak = lastWeek ? computeStreak(next.weeks, lastWeek, next.freezes, next.stats.settledWeek).streak : 0;
  out.push(
    db
      .prepare('UPDATE users SET total_xp = ?, level = ?, streak_weeks = ?, streak_week = ?, best_streak = ?, streak_freezes = ?, stats_json = ? WHERE id = ?')
      .bind(next.totalXp, levelForXp(next.totalXp), streak, lastWeek, next.stats.bestStreak, next.freezes, JSON.stringify(next.stats), userId),
  );
  for (const p of pbRows) {
    out.push(
      db
        .prepare(
          'INSERT INTO personal_bests (user_id, exercise_id, kind, value, workout_id, achieved_at) VALUES (?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT(user_id, exercise_id, kind) DO UPDATE SET value = excluded.value, workout_id = excluded.workout_id, achieved_at = excluded.achieved_at',
        )
        .bind(userId, p.exerciseId, p.kind, p.value, p.workoutId, p.at),
    );
  }
  for (const [week, w] of Object.entries(next.weeks)) {
    if (JSON.stringify(prev.weeks[week]) === JSON.stringify(w)) continue;
    out.push(
      db
        .prepare(
          'INSERT INTO weekly_stats (user_id, week, workouts, xp, goal, frozen) VALUES (?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT(user_id, week) DO UPDATE SET workouts = excluded.workouts, xp = excluded.xp, goal = excluded.goal, frozen = excluded.frozen',
        )
        .bind(userId, week, w.workouts, w.xp, w.goal, w.frozen ? 1 : 0),
    );
  }
  for (const [id, t] of Object.entries(next.trophies)) {
    if (prev.trophies[id]?.tier === t.tier) continue;
    out.push(
      db
        .prepare(
          'INSERT INTO user_trophies (user_id, trophy_id, tier, unlocked_at, workout_id) VALUES (?, ?, ?, ?, ?) ' +
            'ON CONFLICT(user_id, trophy_id) DO UPDATE SET tier = excluded.tier, unlocked_at = excluded.unlocked_at, workout_id = excluded.workout_id',
        )
        .bind(userId, id, t.tier, t.at, t.workoutId ?? null),
    );
  }
  return out;
}

function workoutResultStatements(db: D1Database, userId: string, s: WorkoutSummary, at: number): D1PreparedStatement[] {
  const out = [
    db
      .prepare('UPDATE workouts SET xp_awarded = ?, total_volume_kg = ?, total_sets = ?, total_reps = ?, summary_json = ? WHERE id = ? AND user_id = ?')
      .bind(s.xp.total, s.volumeKg, s.sets, s.reps, JSON.stringify(s), s.workoutId, userId),
  ];
  const parts: Array<[string, number]> = [
    ['sets', s.xp.sets], ['cardio', s.xp.cardio], ['streak', s.xp.streak], ['pb', s.xp.pb], ['duration', s.xp.duration],
    ['weekly_goal', s.xp.weeklyGoal], ['cap', s.xp.total - s.xp.raw],
  ];
  for (const [kind, amount] of parts) {
    if (amount !== 0) out.push(db.prepare('INSERT INTO xp_events (id, user_id, workout_id, kind, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(uid(), userId, s.workoutId, kind, amount, at));
  }
  return out;
}

/** Apply a freshly inserted workout on top of the stored state (the common, cheap path). */
export async function applyWorkout(db: D1Database, userId: string, workout: GWorkout): Promise<WorkoutSummary> {
  const [{ state: prev, weeklyGoal }, metaOf] = await Promise.all([loadState(db, userId), loadMeta(db, userId)]);
  // Out-of-order arrival (e.g. an offline workout synced late): replay everything instead.
  if (workout.startedAt < prev.stats.lastWorkoutAt) {
    const summaries = await recalcUser(db, userId);
    return summaries.get(workout.id)!;
  }
  const { state, summary } = processWorkout(prev, workout, { metaOf, weeklyGoal });
  const pbRows = summary.pbs.map((p) => ({ exerciseId: p.exerciseId, kind: p.kind, value: p.value, workoutId: workout.id, at: workout.endedAt }));
  await runBatches(db, [...stateStatements(db, userId, prev, state, pbRows), ...workoutResultStatements(db, userId, summary, workout.endedAt)]);
  return summary;
}

export async function loadWorkouts(db: D1Database, userId: string): Promise<GWorkout[]> {
  const [ws, sets] = await db.batch([
    db.prepare('SELECT id, started_at, ended_at, tz_offset_min FROM workouts WHERE user_id = ? ORDER BY started_at').bind(userId),
    db
      .prepare(
        'SELECT w.id AS workout_id, we.id AS wex_id, we.exercise_id, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.rpe ' +
          'FROM workouts w JOIN workout_exercises we ON we.workout_id = w.id JOIN sets s ON s.workout_exercise_id = we.id ' +
          'WHERE w.user_id = ? ORDER BY w.started_at, we.position, s.position',
      )
      .bind(userId),
  ]);
  const byId = new Map<string, GWorkout>();
  for (const w of ws!.results as Array<{ id: string; started_at: number; ended_at: number; tz_offset_min: number }>) {
    byId.set(w.id, { id: w.id, startedAt: w.started_at, endedAt: w.ended_at, tzOffsetMin: w.tz_offset_min, exercises: [] });
  }
  let lastWex = '';
  for (const r of sets!.results as Array<{ workout_id: string; wex_id: string; exercise_id: string; set_type: SetType; weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null; rpe: number | null }>) {
    const w = byId.get(r.workout_id)!;
    if (r.wex_id !== lastWex) {
      w.exercises.push({ exerciseId: r.exercise_id, sets: [] });
      lastWex = r.wex_id;
    }
    w.exercises.at(-1)!.sets.push({ type: r.set_type, weightKg: r.weight_kg, reps: r.reps, durationS: r.duration_s, distanceM: r.distance_m, rpe: r.rpe });
  }
  return [...byId.values()];
}

async function sideCounts(db: D1Database, userId: string): Promise<Pick<Stats, 'following' | 'routines'>> {
  const r = await db
    .prepare('SELECT (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following, (SELECT COUNT(*) FROM routines WHERE user_id = ?1) AS routines')
    .bind(userId)
    .first<{ following: number; routines: number }>();
  return { following: r?.following ?? 0, routines: r?.routines ?? 0 };
}

/**
 * Rebuild a user's whole game state from their workout history. Used after edits, deletes and
 * out-of-order syncs so XP, PBs, streaks and trophies always match the stored workouts.
 */
export async function recalcUser(db: D1Database, userId: string): Promise<Map<string, WorkoutSummary>> {
  const [{ state: old, weeklyGoal }, metaOf, workouts, counts] = await Promise.all([loadState(db, userId), loadMeta(db, userId), loadWorkouts(db, userId), sideCounts(db, userId)]);
  const { state, summaries } = replay(workouts, { metaOf, weeklyGoal }, counts, (week) => old.weeks[week]?.goal);
  awardTrophies(state, now(), null);
  // Keep the original unlock date of trophies the player still holds.
  for (const [id, t] of Object.entries(state.trophies)) {
    const before = old.trophies[id];
    if (before && before.tier >= t.tier) Object.assign(t, { at: before.at, workoutId: before.workoutId });
  }
  const pbRows = new Map<string, PbRow>();
  for (const w of workouts) {
    for (const p of summaries.get(w.id)?.pbs ?? []) pbRows.set(`${p.exerciseId}:${p.kind}`, { exerciseId: p.exerciseId, kind: p.kind, value: p.value, workoutId: w.id, at: w.endedAt });
  }
  const statements = [
    db.prepare('DELETE FROM personal_bests WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM weekly_stats WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM user_trophies WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM xp_events WHERE user_id = ?').bind(userId),
    ...stateStatements(db, userId, emptyState(), state, [...pbRows.values()]),
  ];
  for (const w of workouts) statements.push(...workoutResultStatements(db, userId, summaries.get(w.id)!, w.endedAt));
  await runBatches(db, statements);
  return summaries;
}

/** Re-evaluate trophies that depend on things other than workouts (follows, routines). */
export async function syncSideStats(db: D1Database, userId: string): Promise<Array<{ id: string; tier: number }>> {
  const [{ state: prev }, counts] = await Promise.all([loadState(db, userId), sideCounts(db, userId)]);
  const state = structuredClone(prev);
  Object.assign(state.stats, counts);
  const unlocked = awardTrophies(state, now(), null);
  await runBatches(db, stateStatements(db, userId, prev, state, []));
  return unlocked;
}
