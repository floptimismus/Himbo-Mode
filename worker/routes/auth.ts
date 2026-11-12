import { zValidator } from '@hono/zod-validator';
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { displayNameSchema, usernameSchema } from '../../shared/schemas.ts';
import type { AppEnv } from '../env.ts';
import { fromB64u, HttpError, now, originAllowed, rateLimit, sha256, toB64u, uid } from '../lib/util.ts';
import { createSession, destroySession, requireAuth } from '../middleware/session.ts';

const CHALLENGE_TTL_MS = 5 * 60_000;
const RECOVERY_CODE_COUNT = 8;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// The WebAuthn responses are verified by @simplewebauthn; we only check the envelope here.
const credentialResponse = z.object({ id: z.string(), rawId: z.string(), response: z.record(z.string(), z.unknown()), type: z.literal('public-key') }).loose();

interface ChallengeRow {
  id: string;
  challenge: string;
  kind: string;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
  expires_at: number;
}

function expectedOrigin(c: Context<AppEnv>): string {
  const origin = c.req.header('Origin');
  if (!originAllowed(c.env, origin)) throw new HttpError(403, 'bad_origin');
  return origin;
}

async function storeChallenge(c: Context<AppEnv>, kind: string, challenge: string, user?: { id: string; username?: string; displayName?: string | null }) {
  const id = uid();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM auth_challenges WHERE expires_at < ?').bind(now()),
    c.env.DB.prepare('INSERT INTO auth_challenges (id, challenge, kind, user_id, username, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
      id, challenge, kind, user?.id ?? null, user?.username ?? null, user?.displayName ?? null, now() + CHALLENGE_TTL_MS,
    ),
  ]);
  return id;
}

/** Challenges are single-use: fetched and deleted in one go. */
async function takeChallenge(c: Context<AppEnv>, id: string, kind: string): Promise<ChallengeRow> {
  const row = await c.env.DB.prepare('DELETE FROM auth_challenges WHERE id = ? AND kind = ? RETURNING *').bind(id, kind).first<ChallengeRow>();
  if (!row || row.expires_at < now()) throw new HttpError(400, 'challenge_expired', 'The sign-in attempt expired. Please try again.');
  return row;
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
}

const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
const hashCode = (userId: string, code: string) => sha256(`${userId}:${normalizeCode(code)}`);

/** Replaces all recovery codes of a user; returns the plain codes (shown once) and the statements. */
export async function recoveryCodeStatements(db: D1Database, userId: string) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, randomCode);
  const statements = [db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').bind(userId)];
  for (const code of codes) {
    statements.push(db.prepare('INSERT INTO recovery_codes (id, user_id, code_hash) VALUES (?, ?, ?)').bind(uid(), userId, await hashCode(userId, code)));
  }
  return { codes, statements };
}

function credentialInsert(db: D1Database, userId: string, cred: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] }, deviceName: string | null) {
  return db
    .prepare('INSERT INTO passkey_credentials (id, user_id, public_key, counter, transports, device_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(cred.id, userId, toB64u(cred.publicKey), cred.counter, JSON.stringify(cred.transports ?? []), deviceName, now());
}

const deviceLabel = (c: Context<AppEnv>) => {
  const ua = c.req.header('User-Agent') ?? '';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [browser, os].filter(Boolean).join(' · ') || null;
};

export const auth = new Hono<AppEnv>()
  // ── Sign-up ──
  .post('/register/options', zValidator('json', z.object({ username: usernameSchema, displayName: displayNameSchema.optional() })), async (c) => {
    await rateLimit(c, 'register', 10, 600);
    const { username, displayName } = c.req.valid('json');
    const taken = await c.env.DB.prepare('SELECT 1 FROM users WHERE username_lower = ?').bind(username.toLowerCase()).first();
    if (taken) throw new HttpError(409, 'username_taken', 'This username is already taken.');
    const userId = uid();
    const options = await generateRegistrationOptions({
      rpName: c.env.RP_NAME,
      rpID: c.env.RP_ID,
      userName: username,
      userDisplayName: displayName || username,
      userID: new Uint8Array(new TextEncoder().encode(userId)),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    const challengeId = await storeChallenge(c, 'register', options.challenge, { id: userId, username, displayName: displayName || null });
    return c.json({ challengeId, options });
  })
  .post('/register/verify', zValidator('json', z.object({ challengeId: z.string(), response: credentialResponse, locale: z.enum(['en', 'de']).optional() })), async (c) => {
    await rateLimit(c, 'register', 10, 600);
    const body = c.req.valid('json');
    const ch = await takeChallenge(c, body.challengeId, 'register');
    const result = await verifyRegistrationResponse({
      response: body.response as never,
      expectedChallenge: ch.challenge,
      expectedOrigin: expectedOrigin(c),
      expectedRPID: c.env.RP_ID,
      requireUserVerification: false,
    }).catch((e: Error) => {
      throw new HttpError(400, 'verification_failed', e.message);
    });
    if (!result.verified) throw new HttpError(400, 'verification_failed');
    const userId = ch.user_id!;
    const { codes, statements } = await recoveryCodeStatements(c.env.DB, userId);
    try {
      await c.env.DB.batch([
        c.env.DB.prepare('INSERT INTO users (id, username, username_lower, display_name, locale, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
          userId, ch.username, ch.username!.toLowerCase(), ch.display_name, body.locale ?? 'en', `a${1 + Math.floor(Math.random() * 12)}`, now(),
        ),
        credentialInsert(c.env.DB, userId, result.registrationInfo.credential, deviceLabel(c)),
        ...statements,
      ]);
    } catch (e) {
      if (String(e).includes('UNIQUE')) throw new HttpError(409, 'username_taken', 'This username is already taken.');
      throw e;
    }
    await createSession(c, userId);
    return c.json({ recoveryCodes: codes });
  })
  // ── Login (discoverable credential: no username needed) ──
  .post('/login/options', async (c) => {
    await rateLimit(c, 'login', 30, 600);
    const options = await generateAuthenticationOptions({ rpID: c.env.RP_ID, userVerification: 'preferred' });
    const challengeId = await storeChallenge(c, 'login', options.challenge);
    return c.json({ challengeId, options });
  })
  .post('/login/verify', zValidator('json', z.object({ challengeId: z.string(), response: credentialResponse })), async (c) => {
    await rateLimit(c, 'login', 30, 600);
    const body = c.req.valid('json');
    const ch = await takeChallenge(c, body.challengeId, 'login');
    const cred = await c.env.DB.prepare('SELECT id, user_id, public_key, counter, transports FROM passkey_credentials WHERE id = ?')
      .bind(body.response.id)
      .first<{ id: string; user_id: string; public_key: string; counter: number; transports: string | null }>();
    if (!cred) throw new HttpError(400, 'unknown_passkey', 'This passkey is not registered here.');
    const result = await verifyAuthenticationResponse({
      response: body.response as never,
      expectedChallenge: ch.challenge,
      expectedOrigin: expectedOrigin(c),
      expectedRPID: c.env.RP_ID,
      requireUserVerification: false,
      credential: { id: cred.id, publicKey: fromB64u(cred.public_key), counter: cred.counter },
    }).catch((e: Error) => {
      throw new HttpError(400, 'verification_failed', e.message);
    });
    if (!result.verified) throw new HttpError(400, 'verification_failed');
    await c.env.DB.prepare('UPDATE passkey_credentials SET counter = ?, last_used_at = ? WHERE id = ?').bind(result.authenticationInfo.newCounter, now(), cred.id).run();
    await createSession(c, cred.user_id);
    return c.json({ ok: true });
  })
  // ── Recovery code login (lockout protection) ──
  .post('/recover', zValidator('json', z.object({ username: usernameSchema, code: z.string().min(8).max(20) })), async (c) => {
    const { username, code } = c.req.valid('json');
    await rateLimit(c, 'recover', 8, 900);
    await rateLimit(c, 'recover-user', 8, 900, username.toLowerCase());
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE username_lower = ?').bind(username.toLowerCase()).first<{ id: string }>();
    const used = user
      ? await c.env.DB.prepare('UPDATE recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL RETURNING id')
          .bind(now(), user.id, await hashCode(user.id, code))
          .first()
      : null;
    if (!user || !used) throw new HttpError(400, 'invalid_recovery', 'Username or recovery code is wrong.');
    await createSession(c, user.id);
    return c.json({ ok: true });
  })
  .post('/logout', async (c) => {
    await destroySession(c);
    return c.json({ ok: true });
  });

/** Passkey and recovery-code management for the signed-in user (mounted under /me). */
export const passkeys = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/passkeys', async (c) => {
    const rows = await c.env.DB.prepare('SELECT id, device_name, created_at, last_used_at FROM passkey_credentials WHERE user_id = ? ORDER BY created_at')
      .bind(c.var.user.id)
      .all<{ id: string; device_name: string | null; created_at: number; last_used_at: number | null }>();
    const codes = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL').bind(c.var.user.id).first<{ n: number }>();
    return c.json({
      passkeys: rows.results.map((r) => ({ id: r.id, deviceName: r.device_name, createdAt: r.created_at, lastUsedAt: r.last_used_at })),
      recoveryCodesLeft: codes?.n ?? 0,
    });
  })
  .post('/passkeys/options', async (c) => {
    await rateLimit(c, 'passkey-add', 10, 600);
    const user = c.var.user;
    const existing = await c.env.DB.prepare('SELECT id FROM passkey_credentials WHERE user_id = ?').bind(user.id).all<{ id: string }>();
    const options = await generateRegistrationOptions({
      rpName: c.env.RP_NAME,
      rpID: c.env.RP_ID,
      userName: user.username,
      userID: new Uint8Array(new TextEncoder().encode(user.id)),
      attestationType: 'none',
      excludeCredentials: existing.results.map((r) => ({ id: r.id })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    const challengeId = await storeChallenge(c, 'add', options.challenge, { id: user.id });
    return c.json({ challengeId, options });
  })
  .post('/passkeys/verify', zValidator('json', z.object({ challengeId: z.string(), response: credentialResponse })), async (c) => {
    const body = c.req.valid('json');
    const ch = await takeChallenge(c, body.challengeId, 'add');
    if (ch.user_id !== c.var.user.id) throw new HttpError(400, 'challenge_expired');
    const result = await verifyRegistrationResponse({
      response: body.response as never,
      expectedChallenge: ch.challenge,
      expectedOrigin: expectedOrigin(c),
      expectedRPID: c.env.RP_ID,
      requireUserVerification: false,
    }).catch((e: Error) => {
      throw new HttpError(400, 'verification_failed', e.message);
    });
    if (!result.verified) throw new HttpError(400, 'verification_failed');
    await credentialInsert(c.env.DB, c.var.user.id, result.registrationInfo.credential, deviceLabel(c)).run();
    return c.json({ ok: true });
  })
  .delete('/passkeys/:id', async (c) => {
    const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM passkey_credentials WHERE user_id = ?').bind(c.var.user.id).first<{ n: number }>();
    if ((count?.n ?? 0) <= 1) throw new HttpError(400, 'last_passkey', 'You cannot remove your last passkey.');
    await c.env.DB.prepare('DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.var.user.id).run();
    return c.json({ ok: true });
  })
  .post('/recovery-codes', async (c) => {
    await rateLimit(c, 'recovery-regen', 5, 3600);
    const { codes, statements } = await recoveryCodeStatements(c.env.DB, c.var.user.id);
    await c.env.DB.batch(statements);
    return c.json({ recoveryCodes: codes });
  });
