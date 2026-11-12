import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { GameResponse, MeResponse, MeUser } from '../../shared/api.ts';
import { levelForXp } from '../../shared/game/levels.ts';
import { computeStreak, localParts, weekInDanger, weekKey, weekMet } from '../../shared/game/streak.ts';
import { settingsSchema } from '../../shared/schemas.ts';
import type { AppEnv } from '../env.ts';
import { HttpError, now, rateLimit } from '../lib/util.ts';
import { destroySession, requireAuth } from '../middleware/session.ts';
import { loadState } from '../services/game.ts';

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string;
  locale: string;
  theme: string;
  units: string;
  weekly_goal: number;
  leaderboard_visible: number;
  workouts_public: number;
  created_at: number;
}

const toUser = (r: UserRow): MeUser => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  avatar: r.avatar,
  locale: r.locale as MeUser['locale'],
  theme: r.theme as MeUser['theme'],
  units: r.units as MeUser['units'],
  weeklyGoal: r.weekly_goal,
  leaderboardVisible: !!r.leaderboard_visible,
  workoutsPublic: !!r.workouts_public,
  createdAt: r.created_at,
});

const COLUMNS: Record<string, string> = {
  displayName: 'display_name', avatar: 'avatar', locale: 'locale', theme: 'theme', units: 'units',
  weeklyGoal: 'weekly_goal', leaderboardVisible: 'leaderboard_visible', workoutsPublic: 'workouts_public',
};

export const me = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', async (c) => {
    const db = c.env.DB;
    const userId = c.var.user.id;
    const tz = Number(c.req.query('tz') ?? 0) || 0;
    const [row, { state }] = await Promise.all([db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>(), loadState(db, userId)]);
    if (!row) throw new HttpError(401, 'unauthorized');
    const t = now();
    const week = weekKey(t, tz);
    // The current week is always judged against the goal the user has set right now.
    const current = state.weeks[week] ? { ...state.weeks[week], goal: row.weekly_goal } : undefined;
    const weeks = current ? { ...state.weeks, [week]: current } : state.weeks;
    const streak = computeStreak(weeks, week, state.freezes, state.stats.settledWeek);
    const before = streak.streak - (streak.currentMet ? 1 : 0);
    const body: MeResponse = {
      user: toUser(row),
      game: {
        totalXp: state.totalXp,
        level: levelForXp(state.totalXp),
        streak: streak.streak,
        bestStreak: Math.max(state.stats.bestStreak, streak.best),
        freezes: streak.freezes,
        weekWorkouts: current?.workouts ?? 0,
        weekGoal: row.weekly_goal,
        weekMet: weekMet(current),
        inDanger: weekInDanger(before, current, row.weekly_goal, localParts(t, tz).weekday),
        workouts: state.stats.workouts,
      },
    };
    return c.json(body);
  })
  .patch('/', zValidator('json', settingsSchema), async (c) => {
    const input = c.req.valid('json');
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      sets.push(`${COLUMNS[key]} = ?`);
      values.push(typeof value === 'boolean' ? Number(value) : value === '' ? null : value);
    }
    if (sets.length) await c.env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...values, c.var.user.id).run();
    return c.json({ ok: true });
  })
  .get('/game', async (c) => {
    const { state } = await loadState(c.env.DB, c.var.user.id);
    return c.json({ state } satisfies GameResponse);
  })
  .get('/export', async (c) => {
    await rateLimit(c, 'export', 10, 3600, c.var.user.id);
    const db = c.env.DB;
    const id = c.var.user.id;
    const q = (sql: string) => db.prepare(sql).bind(id);
    const [user, passkeys, exercises, favorites, routines, routineExercises, workouts, workoutExercises, sets, pbs, xp, trophies, following, followers, weekly] = await db.batch([
      q('SELECT id, username, display_name, avatar, locale, theme, units, weekly_goal, leaderboard_visible, workouts_public, total_xp, level, streak_weeks, best_streak, streak_freezes, created_at FROM users WHERE id = ?'),
      q('SELECT device_name, created_at, last_used_at FROM passkey_credentials WHERE user_id = ?'),
      q('SELECT * FROM exercises WHERE owner_id = ?'),
      q('SELECT exercise_id FROM exercise_favorites WHERE user_id = ?'),
      q('SELECT * FROM routines WHERE user_id = ? ORDER BY position'),
      q('SELECT re.* FROM routine_exercises re JOIN routines r ON r.id = re.routine_id WHERE r.user_id = ? ORDER BY re.routine_id, re.position'),
      q('SELECT id, name, started_at, ended_at, duration_s, tz_offset_min, notes, routine_id, total_volume_kg, total_sets, total_reps, xp_awarded FROM workouts WHERE user_id = ? ORDER BY started_at'),
      q('SELECT we.* FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id WHERE w.user_id = ? ORDER BY we.workout_id, we.position'),
      q('SELECT s.* FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN workouts w ON w.id = we.workout_id WHERE w.user_id = ? ORDER BY s.workout_exercise_id, s.position'),
      q('SELECT exercise_id, kind, value, workout_id, achieved_at FROM personal_bests WHERE user_id = ?'),
      q('SELECT workout_id, kind, amount, created_at FROM xp_events WHERE user_id = ? ORDER BY created_at'),
      q('SELECT trophy_id, tier, unlocked_at FROM user_trophies WHERE user_id = ?'),
      q('SELECT u.username, f.created_at FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ?'),
      q('SELECT u.username, f.created_at FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ?'),
      q('SELECT week, workouts, xp, goal, frozen FROM weekly_stats WHERE user_id = ? ORDER BY week'),
    ]);
    const data = {
      exportedAt: new Date().toISOString(),
      units: { weight: 'kg', distance: 'm', duration: 's', timestamps: 'ms since epoch' },
      user: user!.results[0],
      passkeys: passkeys!.results,
      customExercises: exercises!.results,
      favorites: favorites!.results,
      routines: routines!.results,
      routineExercises: routineExercises!.results,
      workouts: workouts!.results,
      workoutExercises: workoutExercises!.results,
      sets: sets!.results,
      personalBests: pbs!.results,
      xpEvents: xp!.results,
      trophies: trophies!.results,
      following: following!.results,
      followers: followers!.results,
      weeklyStats: weekly!.results,
    };
    return c.body(JSON.stringify(data, null, 2), 200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="himbo-mode-${c.var.user.username}.json"`,
    });
  })
  .delete('/', async (c) => {
    const db = c.env.DB;
    const id = c.var.user.id;
    // Children first so custom exercises are no longer referenced; the rest cascades from users.
    await db.batch([
      db.prepare('DELETE FROM workouts WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM routines WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM users WHERE id = ?').bind(id),
    ]);
    await destroySession(c);
    return c.json({ ok: true });
  });
