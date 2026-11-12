import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../env.ts';
import { HttpError, now, originAllowed, randomToken, sha256 } from '../lib/util.ts';

const COOKIE = 'hm_session';
const TTL_MS = 30 * 86_400_000;

const isHttps = (c: Context<AppEnv>) => new URL(c.req.url).protocol === 'https:';

export async function createSession(c: Context<AppEnv>, userId: string) {
  const token = randomToken();
  const t = now();
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, t, t + TTL_MS)
    .run();
  setCookie(c, COOKIE, token, { httpOnly: true, secure: isHttps(c), sameSite: 'Lax', path: '/', maxAge: TTL_MS / 1000 });
}

export async function destroySession(c: Context<AppEnv>) {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Requires a valid session; rolls the expiry forward when half of it is used up. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) throw new HttpError(401, 'unauthorized');
  const hash = await sha256(token);
  const row = await c.env.DB.prepare(
    'SELECT s.user_id, s.expires_at, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
  )
    .bind(hash)
    .first<{ user_id: string; expires_at: number; username: string }>();
  const t = now();
  if (!row || row.expires_at < t) throw new HttpError(401, 'unauthorized');
  if (row.expires_at - t < TTL_MS / 2) {
    await c.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').bind(t + TTL_MS, hash).run();
    setCookie(c, COOKIE, token, { httpOnly: true, secure: isHttps(c), sameSite: 'Lax', path: '/', maxAge: TTL_MS / 1000 });
  }
  c.set('user', { id: row.user_id, username: row.username });
  await next();
};

/** CSRF defence in depth: state-changing requests must come from an allowed origin. */
export const checkOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !originAllowed(c.env, c.req.header('Origin'))) {
    throw new HttpError(403, 'bad_origin', 'Origin not allowed. Check the ORIGINS variable.');
  }
  await next();
};
