import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { LeaderboardEntry, ProfileResponse, PublicUser } from '../../shared/api.ts';
import { addWeeks, weekKey } from '../../shared/game/streak.ts';
import type { AppEnv } from '../env.ts';
import { HttpError, now, rateLimit } from '../lib/util.ts';
import { requireAuth } from '../middleware/session.ts';
import { syncSideStats } from '../services/game.ts';
import { LIST_SQL, toListItem } from './workouts.ts';

interface PublicRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string;
  level: number;
}

const toPublic = (r: PublicRow): PublicUser => ({ username: r.username, displayName: r.display_name, avatar: r.avatar, level: r.level });

/** A stored streak is only current if its last active week is this week or the previous one. */
const liveStreakSql = (alias = 'u') => `CASE WHEN ${alias}.streak_week >= ? THEN ${alias}.streak_weeks ELSE 0 END`;

export const social = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/users/search', async (c) => {
    await rateLimit(c, 'user-search', 120, 600, c.var.user.id);
    const q = (c.req.query('q') ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (q.length < 2) return c.json({ users: [] });
    const rows = await c.env.DB.prepare('SELECT id, username, display_name, avatar, level FROM users WHERE username_lower LIKE ? ORDER BY username_lower LIMIT 20')
      .bind(`${q}%`)
      .all<PublicRow>();
    return c.json({ users: rows.results.map(toPublic) });
  })
  .get('/users/:username', async (c) => {
    const db = c.env.DB;
    const meId = c.var.user.id;
    const prevWeek = addWeeks(weekKey(now(), 0), -1);
    const u = await db
      .prepare(
        `SELECT id, username, display_name, avatar, level, total_xp, best_streak, workouts_public, created_at, stats_json, ${liveStreakSql('users')} AS streak FROM users WHERE username_lower = ?`,
      )
      .bind(prevWeek, c.req.param('username').toLowerCase())
      .first<PublicRow & { total_xp: number; best_streak: number; workouts_public: number; created_at: number; stats_json: string; streak: number }>();
    if (!u) throw new HttpError(404, 'not_found', 'User not found.');
    const isMe = u.id === meId;
    const showWorkouts = isMe || !!u.workouts_public;
    const [trophies, counts, follows, recent] = await db.batch([
      db.prepare('SELECT trophy_id, tier, unlocked_at FROM user_trophies WHERE user_id = ? ORDER BY unlocked_at DESC').bind(u.id),
      db
        .prepare(
          'SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?1) AS followers, (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following,' +
            ' (SELECT COUNT(*) FROM workouts WHERE user_id = ?1) AS workouts',
        )
        .bind(u.id),
      db.prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?').bind(meId, u.id),
      db.prepare(`${LIST_SQL} WHERE w.user_id = ? ORDER BY w.started_at DESC LIMIT ?`).bind(u.id, showWorkouts ? 5 : 0),
    ]);
    const n = counts!.results[0] as { followers: number; following: number; workouts: number };
    const body: ProfileResponse = {
      ...toPublic(u),
      totalXp: u.total_xp,
      streak: u.streak,
      bestStreak: u.best_streak,
      workouts: n.workouts,
      followers: n.followers,
      following: n.following,
      isMe,
      isFollowing: follows!.results.length > 0,
      trophies: (trophies!.results as Array<{ trophy_id: string; tier: number; unlocked_at: number }>).map((t) => ({ id: t.trophy_id, tier: t.tier, at: t.unlocked_at })),
      recentWorkouts: showWorkouts ? (recent!.results as never[]).map(toListItem) : null,
      createdAt: u.created_at,
    };
    return c.json(body);
  })
  .put('/users/:username/follow', async (c) => {
    await rateLimit(c, 'follow', 120, 3600, c.var.user.id);
    const target = await c.env.DB.prepare('SELECT id FROM users WHERE username_lower = ?').bind(c.req.param('username').toLowerCase()).first<{ id: string }>();
    if (!target) throw new HttpError(404, 'not_found');
    if (target.id === c.var.user.id) throw new HttpError(400, 'self_follow', 'You cannot follow yourself.');
    await c.env.DB.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)').bind(c.var.user.id, target.id, now()).run();
    const unlocked = await syncSideStats(c.env.DB, c.var.user.id);
    return c.json({ ok: true, unlocked });
  })
  .delete('/users/:username/follow', async (c) => {
    await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = (SELECT id FROM users WHERE username_lower = ?)')
      .bind(c.var.user.id, c.req.param('username').toLowerCase())
      .run();
    return c.json({ ok: true });
  })
  .get('/following', async (c) => {
    const rows = await c.env.DB.prepare(
      'SELECT u.id, u.username, u.display_name, u.avatar, u.level FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ? ORDER BY u.username_lower',
    )
      .bind(c.var.user.id)
      .all<PublicRow>();
    return c.json({ users: rows.results.map(toPublic) });
  })
  // Only users who opted in (leaderboard_visible) appear; you always see yourself.
  .get(
    '/leaderboard',
    zValidator('query', z.object({ scope: z.enum(['global', 'friends']).default('global'), metric: z.enum(['xp_all', 'xp_week', 'streak']).default('xp_all') })),
    async (c) => {
      const { scope, metric } = c.req.valid('query');
      const meId = c.var.user.id;
      const week = weekKey(now(), 0);
      // Placeholders are bound in textual order: value → join → viewer filter.
      const binds: unknown[] = [];
      let value = 'u.total_xp';
      let join = '';
      if (metric === 'streak') {
        value = liveStreakSql();
        binds.push(addWeeks(week, -1));
      } else if (metric === 'xp_week') {
        value = 'COALESCE(ws.xp, 0)';
        join = 'LEFT JOIN weekly_stats ws ON ws.user_id = u.id AND ws.week = ?';
        binds.push(week);
      }
      let who = '(u.id = ? OR u.leaderboard_visible = 1)';
      binds.push(meId);
      if (scope === 'friends') {
        who = '(u.id = ? OR (u.leaderboard_visible = 1 AND u.id IN (SELECT followee_id FROM follows WHERE follower_id = ?)))';
        binds.push(meId);
      }
      const rows = await c.env.DB.prepare(
        `SELECT * FROM (SELECT u.id, u.username, u.username_lower, u.display_name, u.avatar, u.level, ${value} AS value FROM users u ${join} WHERE ${who})` +
          ' WHERE value > 0 ORDER BY value DESC, username_lower LIMIT 50',
      )
        .bind(...binds)
        .all<PublicRow & { value: number }>();
      const entries: LeaderboardEntry[] = rows.results.map((r, i) => ({ ...toPublic(r), rank: i + 1, value: r.value, isMe: r.id === meId }));
      return c.json({ entries });
    },
  );

