import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Routine } from '../../shared/api.ts';
import { LIMITS } from '../../shared/game/constants.ts';
import { routineSchema, type RoutineInput } from '../../shared/schemas.ts';
import type { AppEnv } from '../env.ts';
import { HttpError, now, uid } from '../lib/util.ts';
import { requireAuth } from '../middleware/session.ts';
import { syncSideStats } from '../services/game.ts';
import { assertExercisesExist } from './exercises.ts';

function exerciseStatements(db: D1Database, routineId: string, exercises: RoutineInput['exercises']) {
  return exercises.map((ex, position) =>
    db
      .prepare('INSERT INTO routine_exercises (id, routine_id, exercise_id, position, target_sets, target_reps, target_weight_kg, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(uid(), routineId, ex.exerciseId, position, ex.targetSets, ex.targetReps ?? null, ex.targetWeightKg ?? null, ex.notes || null),
  );
}

async function listRoutines(db: D1Database, userId: string): Promise<Routine[]> {
  const [routines, exercises] = await db.batch([
    db.prepare('SELECT id, name, position, updated_at FROM routines WHERE user_id = ? ORDER BY position, created_at').bind(userId),
    db
      .prepare(
        'SELECT re.routine_id, re.exercise_id, re.target_sets, re.target_reps, re.target_weight_kg, re.notes' +
          ' FROM routine_exercises re JOIN routines r ON r.id = re.routine_id WHERE r.user_id = ? ORDER BY re.routine_id, re.position',
      )
      .bind(userId),
  ]);
  const byId = new Map<string, Routine>();
  for (const r of routines!.results as Array<{ id: string; name: string; position: number; updated_at: number }>) {
    byId.set(r.id, { id: r.id, name: r.name, position: r.position, updatedAt: r.updated_at, exercises: [] });
  }
  for (const e of exercises!.results as Array<{ routine_id: string; exercise_id: string; target_sets: number; target_reps: number | null; target_weight_kg: number | null; notes: string | null }>) {
    byId.get(e.routine_id)?.exercises.push({ exerciseId: e.exercise_id, targetSets: e.target_sets, targetReps: e.target_reps, targetWeightKg: e.target_weight_kg, notes: e.notes });
  }
  return [...byId.values()];
}

async function createRoutine(db: D1Database, userId: string, input: RoutineInput) {
  const count = await db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS max FROM routines WHERE user_id = ?').bind(userId).first<{ n: number; max: number }>();
  if ((count?.n ?? 0) >= LIMITS.routines) throw new HttpError(400, 'limit_reached', 'Routine limit reached.');
  await assertExercisesExist(db, userId, input.exercises.map((e) => e.exerciseId));
  const id = uid();
  const t = now();
  await db.batch([
    db.prepare('INSERT INTO routines (id, user_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, userId, input.name, (count?.max ?? -1) + 1, t, t),
    ...exerciseStatements(db, id, input.exercises),
  ]);
  return id;
}

export const routines = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', async (c) => c.json({ routines: await listRoutines(c.env.DB, c.var.user.id) }))
  .post('/', zValidator('json', routineSchema), async (c) => {
    const id = await createRoutine(c.env.DB, c.var.user.id, c.req.valid('json'));
    const unlocked = await syncSideStats(c.env.DB, c.var.user.id);
    return c.json({ id, unlocked });
  })
  .put('/order', zValidator('json', z.object({ ids: z.array(z.string()).max(LIMITS.routines) })), async (c) => {
    const { ids } = c.req.valid('json');
    if (ids.length) {
      await c.env.DB.batch(ids.map((id, i) => c.env.DB.prepare('UPDATE routines SET position = ? WHERE id = ? AND user_id = ?').bind(i, id, c.var.user.id)));
    }
    return c.json({ ok: true });
  })
  .put('/:id', zValidator('json', routineSchema), async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const owned = await db.prepare('SELECT 1 FROM routines WHERE id = ? AND user_id = ?').bind(id, c.var.user.id).first();
    if (!owned) throw new HttpError(404, 'not_found');
    await assertExercisesExist(db, c.var.user.id, input.exercises.map((e) => e.exerciseId));
    await db.batch([
      db.prepare('UPDATE routines SET name = ?, updated_at = ? WHERE id = ?').bind(input.name, now(), id),
      db.prepare('DELETE FROM routine_exercises WHERE routine_id = ?').bind(id),
      ...exerciseStatements(db, id, input.exercises),
    ]);
    return c.json({ ok: true });
  })
  .post('/:id/duplicate', zValidator('json', z.object({ name: z.string().trim().min(1).max(LIMITS.nameLength) })), async (c) => {
    const source = (await listRoutines(c.env.DB, c.var.user.id)).find((r) => r.id === c.req.param('id'));
    if (!source) throw new HttpError(404, 'not_found');
    const id = await createRoutine(c.env.DB, c.var.user.id, { name: c.req.valid('json').name, exercises: source.exercises });
    await syncSideStats(c.env.DB, c.var.user.id);
    return c.json({ id });
  })
  .delete('/:id', async (c) => {
    const res = await c.env.DB.prepare('DELETE FROM routines WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.var.user.id).run();
    if (!res.meta.changes) throw new HttpError(404, 'not_found');
    return c.json({ ok: true });
  });
