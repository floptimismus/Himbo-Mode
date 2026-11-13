import type { Context } from 'hono';
import type { AppEnv, Env } from '../env.ts';

export const uid = () => crypto.randomUUID();
export const now = () => Date.now();

export function toB64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32): string {
  return toB64u(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** `ORIGINS` is a comma-separated allowlist; `*` matches part of one DNS label (preview URLs). */
export function originAllowed(env: Env, origin: string | undefined | null): origin is string {
  if (!origin) return false;
  return env.ORIGINS.split(',').some((raw) => {
    const pattern = raw.trim();
    if (!pattern) return false;
    const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[a-z0-9-]+') + '$');
    return re.test(origin);
  });
}

export class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 429, public code: string, message?: string) {
    super(message ?? code);
  }
}

export const clientIp = (c: Context<AppEnv>) => c.req.header('CF-Connecting-IP') ?? 'local';

/** Fixed-window rate limit backed by D1. Throws 429 when `limit` is exceeded within `windowS`. */
export async function rateLimit(c: Context<AppEnv>, name: string, limit: number, windowS: number, subject = clientIp(c)) {
  if (c.env.RATE_LIMITS === 'off' && c.env.RP_ID === 'localhost') return;
  const windowStart = Math.floor(now() / 1000 / windowS) * windowS;
  const row = await c.env.DB.prepare(
    'INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count',
  )
    .bind(`${name}:${subject}`, windowStart)
    .first<{ count: number }>();
  if (Math.random() < 0.02) {
    c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(windowStart - 86_400).run());
  }
  if ((row?.count ?? 0) > limit) throw new HttpError(429, 'rate_limited', 'Too many attempts. Please try again later.');
}

/** D1 batches are transactions; keep each one comfortably small. */
export async function runBatches(db: D1Database, statements: D1PreparedStatement[], size = 80) {
  for (let i = 0; i < statements.length; i += size) await db.batch(statements.slice(i, i + size));
}

export const parseJson = <T>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};
