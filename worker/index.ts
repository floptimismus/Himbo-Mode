import { Hono } from 'hono';
import type { AppEnv } from './env.ts';
import { HttpError } from './lib/util.ts';
import { checkOrigin, sessionUser } from './middleware/session.ts';
import { auth, passkeys } from './routes/auth.ts';
import { exercises } from './routes/exercises.ts';
import { buildMe, me } from './routes/me.ts';
import { routines } from './routes/routines.ts';
import { social } from './routes/social.ts';
import { workouts } from './routes/workouts.ts';

const app = new Hono<AppEnv>().basePath('/api');

app.use(async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});
app.use(checkOrigin);

app.get('/health', (c) => c.json({ ok: true }));
// Signed-out visitors get `null` instead of a 401, so the first page load stays error-free.
app.get('/session', async (c) => {
  const user = await sessionUser(c);
  return c.json(user ? await buildMe(c.env.DB, user.id, Number(c.req.query('tz') ?? 0) || 0) : null);
});
app.route('/auth', auth);
app.route('/me', passkeys);
app.route('/me', me);
app.route('/exercises', exercises);
app.route('/workouts', workouts);
app.route('/routines', routines);
app.route('/', social);

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.code, message: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'internal', message: 'Something went wrong.' }, 500);
});

export default app;
