import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { SaveWorkoutResponse, WorkoutDetail, WorkoutListItem } from '../../shared/api.ts';
import { LIMITS } from '../../shared/game/constants.ts';
import { validExercises, type MetaLookup } from '../../shared/game/engine.ts';
import type { GSet, GWorkout, SetType, WorkoutSummary } from '../../shared/game/types.ts';
import { workoutEditSchema, workoutSchema, type WorkoutInput } from '../../shared/schemas.ts';
import type { AppEnv } from '../env.ts';
import { HttpError, now, parseJson, rateLimit, runBatches, uid } from '../lib/util.ts';
import { requireAuth } from '../middleware/session.ts';
import { applyWorkout, loadMeta, recalcUser } from '../services/game.ts';

const CLOCK_SKEW_MS = 5 * 60_000;

interface ListRow {
  id: string;
  name: string;
  started_at: number;
  duration_s: number;
  total_volume_kg: number;
  total_sets: number;
  xp_awarded: number;
  exercise_ids: string | null;
}

export const LIST_SQL =
  'SELECT w.id, w.name, w.started_at, w.duration_s, w.total_volume_kg, w.total_sets, w.xp_awarded,' +
  ' (SELECT group_concat(exercise_id) FROM (SELECT exercise_id FROM workout_exercises WHERE workout_id = w.id ORDER BY position)) AS exercise_ids' +
  ' FROM workouts w';

export const toListItem = (r: ListRow): WorkoutListItem => ({
  id: r.id,
  name: r.name,
  startedAt: r.started_at,
  durationS: r.duration_s,
  volumeKg: r.total_volume_kg,
  sets: r.total_sets,
  xp: r.xp_awarded,
  exerciseIds: r.exercise_ids ? r.exercise_ids.split(',') : [],
});

/** Insert statements for the exercises and sets of a workout. Only valid sets are stored. */
function contentStatements(db: D1Database, workoutId: string, exercises: WorkoutInput['exercises'], metaOf: MetaLookup) {
  const out: D1PreparedStatement[] = [];
  const kept: GWorkout['exercises'] = [];
  exercises.forEach((ex, position) => {
    const valid = validExercises([{ exerciseId: ex.exerciseId, sets: ex.sets as GSet[] }], metaOf)[0];
    if (!valid) return;
    kept.push(valid);
    const wexId = uid();
    out.push(db.prepare('INSERT INTO workout_exercises (id, workout_id, exercise_id, position, notes) VALUES (?, ?, ?, ?, ?)').bind(wexId, workoutId, ex.exerciseId, position, ex.notes || null));
    valid.sets.forEach((s, i) => {
      out.push(
        db
          .prepare('INSERT INTO sets (id, workout_exercise_id, position, set_type, weight_kg, reps, duration_s, distance_m, rpe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(uid(), wexId, i, s.type, s.weightKg ?? null, s.reps ?? null, s.durationS ?? null, s.distanceM ?? null, s.rpe ?? null),
      );
    });
  });
  return { statements: out, kept };
}

export const workouts = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', async (c) => {
    const before = Number(c.req.query('before')) || Number.MAX_SAFE_INTEGER;
    const limit = Math.min(50, Number(c.req.query('limit')) || 20);
    const rows = await c.env.DB.prepare(`${LIST_SQL} WHERE w.user_id = ? AND w.started_at < ? ORDER BY w.started_at DESC LIMIT ?`)
      .bind(c.var.user.id, before, limit)
      .all<ListRow>();
    return c.json({ workouts: rows.results.map(toListItem) });
  })
  // Idempotent: the client generates the id, so a retried sync returns the stored summary.
  .post('/', zValidator('json', workoutSchema), async (c) => {
    const db = c.env.DB;
    const userId = c.var.user.id;
    const input = c.req.valid('json');
    await rateLimit(c, 'workout-save', 60, 3600, userId);

    const existing = await db.prepare('SELECT user_id, summary_json FROM workouts WHERE id = ?').bind(input.id).first<{ user_id: string; summary_json: string | null }>();
    if (existing) {
      if (existing.user_id !== userId) throw new HttpError(409, 'conflict');
      const summary = parseJson<WorkoutSummary | null>(existing.summary_json, null);
      if (summary) return c.json({ summary } satisfies SaveWorkoutResponse);
    }

    const t = now();
    const startedAt = Math.min(input.startedAt, t);
    let endedAt = Math.min(Math.max(input.endedAt, startedAt), t + CLOCK_SKEW_MS);
    if (endedAt - startedAt > LIMITS.workoutDurationS * 1000) endedAt = startedAt + LIMITS.workoutDurationS * 1000;

    const metaOf = await loadMeta(db, userId);
    const { statements, kept } = contentStatements(db, input.id, input.exercises, metaOf);
    if (!existing) {
      await runBatches(db, [
        db
          .prepare('INSERT INTO workouts (id, user_id, name, started_at, ended_at, duration_s, tz_offset_min, notes, routine_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(input.id, userId, input.name, startedAt, endedAt, Math.round((endedAt - startedAt) / 1000), input.tzOffsetMin, input.notes || null, input.routineId ?? null, t),
        ...statements,
      ]);
    }
    const summary = await applyWorkout(db, userId, { id: input.id, startedAt, endedAt, tzOffsetMin: input.tzOffsetMin, exercises: kept });
    return c.json({ summary } satisfies SaveWorkoutResponse);
  })
  .get('/:id', async (c) => {
    const db = c.env.DB;
    const w = await db
      .prepare('SELECT id, name, started_at, ended_at, duration_s, tz_offset_min, notes, routine_id, summary_json FROM workouts WHERE id = ? AND user_id = ?')
      .bind(c.req.param('id'), c.var.user.id)
      .first<{ id: string; name: string; started_at: number; ended_at: number; duration_s: number; tz_offset_min: number; notes: string | null; routine_id: string | null; summary_json: string | null }>();
    if (!w) throw new HttpError(404, 'not_found');
    const rows = await db
      .prepare(
        'SELECT we.id AS wex_id, we.exercise_id, we.notes, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.rpe' +
          ' FROM workout_exercises we LEFT JOIN sets s ON s.workout_exercise_id = we.id WHERE we.workout_id = ? ORDER BY we.position, s.position',
      )
      .bind(w.id)
      .all<{ wex_id: string; exercise_id: string; notes: string | null; set_type: SetType | null; weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null; rpe: number | null }>();
    const exercises: WorkoutDetail['exercises'] = [];
    let last = '';
    for (const r of rows.results) {
      if (r.wex_id !== last) {
        exercises.push({ exerciseId: r.exercise_id, notes: r.notes, sets: [] });
        last = r.wex_id;
      }
      if (r.set_type) exercises.at(-1)!.sets.push({ type: r.set_type, weightKg: r.weight_kg, reps: r.reps, durationS: r.duration_s, distanceM: r.distance_m, rpe: r.rpe });
    }
    const body: WorkoutDetail = {
      id: w.id, name: w.name, startedAt: w.started_at, endedAt: w.ended_at, durationS: w.duration_s, tzOffsetMin: w.tz_offset_min,
      notes: w.notes, routineId: w.routine_id, exercises, summary: parseJson(w.summary_json, null),
    };
    return c.json(body);
  })
  .put('/:id', zValidator('json', workoutEditSchema), async (c) => {
    const db = c.env.DB;
    const userId = c.var.user.id;
    const id = c.req.param('id');
    const input = c.req.valid('json');
    await rateLimit(c, 'workout-edit', 60, 3600, userId);
    const owned = await db.prepare('SELECT 1 FROM workouts WHERE id = ? AND user_id = ?').bind(id, userId).first();
    if (!owned) throw new HttpError(404, 'not_found');
    const metaOf = await loadMeta(db, userId);
    await runBatches(db, [
      db.prepare('UPDATE workouts SET name = ?, notes = ? WHERE id = ?').bind(input.name, input.notes || null, id),
      db.prepare('DELETE FROM workout_exercises WHERE workout_id = ?').bind(id),
      ...contentStatements(db, id, input.exercises, metaOf).statements,
    ]);
    const summaries = await recalcUser(db, userId);
    return c.json({ summary: summaries.get(id)! } satisfies SaveWorkoutResponse);
  })
  .delete('/:id', async (c) => {
    const res = await c.env.DB.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.var.user.id).run();
    if (!res.meta.changes) throw new HttpError(404, 'not_found');
    await recalcUser(c.env.DB, c.var.user.id);
    return c.json({ ok: true });
  });
