import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { CustomExercise, LibraryState } from '../../shared/api.ts';
import { EXERCISE_BY_ID } from '../../shared/data/exercises/index.ts';
import { LIMITS } from '../../shared/game/constants.ts';
import type { SetType } from '../../shared/game/types.ts';
import { customExerciseSchema, type CustomExerciseInput } from '../../shared/schemas.ts';
import type { AppEnv } from '../env.ts';
import { HttpError, now, parseJson, uid } from '../lib/util.ts';
import { requireAuth } from '../middleware/session.ts';

interface ExerciseRow {
  id: string;
  name_en: string;
  name_de: string;
  primary_muscles: string;
  secondary_muscles: string;
  equipment: string;
  tracking: string;
  category: string;
  archived: number;
}

const toCustom = (r: ExerciseRow): CustomExercise => ({
  id: r.id,
  custom: true,
  archived: !!r.archived,
  name: { en: r.name_en, de: r.name_de },
  desc: { en: '', de: '' },
  primary: parseJson(r.primary_muscles, []),
  secondary: parseJson(r.secondary_muscles, []),
  equipment: r.equipment as CustomExercise['equipment'],
  tracking: r.tracking as CustomExercise['tracking'],
  category: r.category as CustomExercise['category'],
});

const categoryFor = (input: CustomExerciseInput) => (input.equipment === 'rugby' ? 'rugby' : input.equipment === 'cardio' ? 'cardio' : 'strength');

/** Exercise id must be a system exercise or one of the user's own. */
export async function assertExercisesExist(db: D1Database, userId: string, ids: string[]) {
  const custom = [...new Set(ids.filter((id) => !EXERCISE_BY_ID.has(id)))];
  if (!custom.length) return;
  const rows = await db
    .prepare(`SELECT id FROM exercises WHERE owner_id = ? AND id IN (${custom.map(() => '?').join(',')})`)
    .bind(userId, ...custom)
    .all<{ id: string }>();
  if (rows.results.length !== custom.length) throw new HttpError(400, 'unknown_exercise', 'Unknown exercise.');
}

export const exercises = new Hono<AppEnv>()
  .use(requireAuth)
  // Everything user-specific about the library in one round trip (system exercises ship with the app).
  .get('/state', async (c) => {
    const db = c.env.DB;
    const userId = c.var.user.id;
    const [custom, favorites, last] = await db.batch([
      db.prepare('SELECT * FROM exercises WHERE owner_id = ? ORDER BY name_en').bind(userId),
      db.prepare('SELECT exercise_id FROM exercise_favorites WHERE user_id = ?').bind(userId),
      db
        .prepare(
          'WITH latest AS (' +
            ' SELECT we.id AS wex_id, we.exercise_id, w.started_at,' +
            ' ROW_NUMBER() OVER (PARTITION BY we.exercise_id ORDER BY w.started_at DESC, we.position) AS rn' +
            ' FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id WHERE w.user_id = ?)' +
            ' SELECT l.exercise_id, l.started_at, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.rpe' +
            ' FROM latest l JOIN sets s ON s.workout_exercise_id = l.wex_id WHERE l.rn = 1 ORDER BY l.started_at DESC, l.exercise_id, s.position',
        )
        .bind(userId),
    ]);
    const lastPerf: LibraryState['lastPerf'] = {};
    for (const r of last!.results as Array<{ exercise_id: string; started_at: number; set_type: SetType; weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null; rpe: number | null }>) {
      (lastPerf[r.exercise_id] ??= { at: r.started_at, sets: [] }).sets.push({
        type: r.set_type, weightKg: r.weight_kg, reps: r.reps, durationS: r.duration_s, distanceM: r.distance_m, rpe: r.rpe,
      });
    }
    const body: LibraryState = {
      custom: (custom!.results as ExerciseRow[]).map(toCustom),
      favorites: (favorites!.results as Array<{ exercise_id: string }>).map((r) => r.exercise_id),
      recents: Object.keys(lastPerf).slice(0, 15),
      lastPerf,
    };
    return c.json(body);
  })
  .post('/', zValidator('json', customExerciseSchema), async (c) => {
    const input = c.req.valid('json');
    const userId = c.var.user.id;
    const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM exercises WHERE owner_id = ? AND archived = 0').bind(userId).first<{ n: number }>();
    if ((count?.n ?? 0) >= LIMITS.customExercises) throw new HttpError(400, 'limit_reached', 'Custom exercise limit reached.');
    const id = `c_${uid()}`;
    await c.env.DB.prepare(
      'INSERT INTO exercises (id, owner_id, name_en, name_de, primary_muscles, secondary_muscles, equipment, tracking, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(id, userId, input.name, input.name, JSON.stringify(input.primary), JSON.stringify(input.secondary.filter((m) => !input.primary.includes(m))), input.equipment, input.tracking, categoryFor(input), now())
      .run();
    return c.json({ id });
  })
  .put('/:id', zValidator('json', customExerciseSchema), async (c) => {
    const input = c.req.valid('json');
    // The tracking type is fixed once created: changing it would invalidate logged sets.
    const res = await c.env.DB.prepare(
      'UPDATE exercises SET name_en = ?, name_de = ?, primary_muscles = ?, secondary_muscles = ?, equipment = ?, category = ? WHERE id = ? AND owner_id = ?',
    )
      .bind(input.name, input.name, JSON.stringify(input.primary), JSON.stringify(input.secondary.filter((m) => !input.primary.includes(m))), input.equipment, categoryFor(input), c.req.param('id'), c.var.user.id)
      .run();
    if (!res.meta.changes) throw new HttpError(404, 'not_found');
    return c.json({ ok: true });
  })
  .delete('/:id', async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    const owned = await db.prepare('SELECT 1 FROM exercises WHERE id = ? AND owner_id = ?').bind(id, c.var.user.id).first();
    if (!owned) throw new HttpError(404, 'not_found');
    const used = await db
      .prepare('SELECT (SELECT COUNT(*) FROM workout_exercises WHERE exercise_id = ?1) + (SELECT COUNT(*) FROM routine_exercises WHERE exercise_id = ?1) AS n')
      .bind(id)
      .first<{ n: number }>();
    // Exercises with history are archived so old workouts keep their name and muscles.
    if (used?.n) await db.prepare('UPDATE exercises SET archived = 1 WHERE id = ?').bind(id).run();
    else await db.prepare('DELETE FROM exercises WHERE id = ?').bind(id).run();
    return c.json({ ok: true });
  })
  .put('/:id/favorite', zValidator('json', z.object({ favorite: z.boolean() })), async (c) => {
    const id = c.req.param('id');
    const userId = c.var.user.id;
    if (c.req.valid('json').favorite) {
      await assertExercisesExist(c.env.DB, userId, [id]);
      await c.env.DB.prepare('INSERT OR IGNORE INTO exercise_favorites (user_id, exercise_id) VALUES (?, ?)').bind(userId, id).run();
    } else {
      await c.env.DB.prepare('DELETE FROM exercise_favorites WHERE user_id = ? AND exercise_id = ?').bind(userId, id).run();
    }
    return c.json({ ok: true });
  });
