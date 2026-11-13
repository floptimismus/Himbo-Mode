# Himbo-Mode

Gamified, mobile-first workout tracker. 8-bit pixel-art game world under Apple-style liquid-glass chrome. Installable PWA, DE/EN, light/dark, passkey sign-in.

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, Zustand
- **Backend:** one Cloudflare Worker (static assets + Hono API), Cloudflare D1, Zod
- **Auth:** passkeys (`@simplewebauthn/*`), one-time recovery codes, `HttpOnly` session cookie
- **Tests:** Vitest (game logic), Playwright (happy path with a virtual authenticator)

Conventions and design rules for contributors are in [`CLAUDE.md`](CLAUDE.md).

---

## Local development

Requirements: Node.js 22+ and npm. No Cloudflare account is needed for local development: wrangler simulates D1 on disk.

```bash
npm install
```

```bash
npm run db:migrate:local
```

```bash
npm run dev
```

Open http://localhost:5173. `npm run dev` creates `.dev.vars` from `.dev.vars.example` on the first run (`RP_ID=localhost`).

### Testing passkeys on localhost

Browsers allow WebAuthn on `http://localhost` without HTTPS, so sign-up works out of the box:

- **macOS / iOS Safari, Chrome, Edge:** use Touch ID, your phone (QR code) or a password manager that stores passkeys.
- **Without real hardware:** Chrome DevTools → ⋮ → *More tools* → *WebAuthn* → *Enable virtual authenticator environment* → add an authenticator (protocol `ctap2`, *Supports resident keys* and *Supports user verification* checked).
- **On a phone in your LAN:** passkeys need a secure origin, so plain `http://192.168.x.x` will not work. Use a tunnel such as `cloudflared tunnel --url http://localhost:5173`, then set `RP_ID` to the tunnel host and add its URL to `ORIGINS` in `.dev.vars`.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with the Worker running in workerd |
| `npm run check` | Type-check, lint and unit tests |
| `npm run e2e` | Playwright happy path (starts the dev server; run `npx playwright install chromium` once) |
| `npm run build` | Production build into `dist/` |
| `npm run db:migrate:local` / `:remote` | Apply D1 migrations locally / to Cloudflare |
| `npm run seed:gen` | Regenerate the exercise seed SQL from `shared/data/exercises` |
| `npm run icons` | Regenerate the app icon and all PNG sizes |

---

## Setup

Things you have to do once by hand. Nothing here needs secrets committed to the repo.

1. **Cloudflare account.** Create one at https://dash.cloudflare.com (the free plan is enough). Note your **Account ID** (dashboard → Workers & Pages → right sidebar).

2. **Log in with wrangler** on your machine:

   ```bash
   npx wrangler login
   ```

3. **Create the D1 database** and paste its id into `wrangler.jsonc` (`d1_databases[0].database_id`, replacing the zeros):

   ```bash
   npx wrangler d1 create himbo-mode
   ```

4. **Choose your domain and set the passkey variables** in `wrangler.jsonc` → `vars`. Passkeys are bound to `RP_ID`; **changing it later invalidates every existing passkey**, so decide before real users sign up.

   - **workers.dev only:** find your subdomain under Workers & Pages → *Your subdomain*. Replace `YOUR-SUBDOMAIN` so that
     `RP_ID` = `himbo-mode.YOUR-SUBDOMAIN.workers.dev` and
     `ORIGINS` = `https://himbo-mode.YOUR-SUBDOMAIN.workers.dev`.
   - **Custom domain (recommended):** add the domain to Cloudflare, then in `wrangler.jsonc` add
     `"routes": [{ "pattern": "himbo.example.com", "custom_domain": true }]`,
     and set `RP_ID` = `himbo.example.com`, `ORIGINS` = `https://himbo.example.com`.

5. **Apply the database migrations** to Cloudflare:

   ```bash
   npm run db:migrate:remote
   ```

6. **First deploy** (from your machine, to check everything works):

   ```bash
   npm run deploy
   ```

7. **Create a Cloudflare API token** for GitHub Actions: dashboard → My Profile → API Tokens → *Create Token* → template **Edit Cloudflare Workers**, then add the permission **Account → D1 → Edit**. Restrict it to your account.

8. **Add GitHub secrets** in the repo: Settings → Secrets and variables → Actions → *New repository secret*:
   - `CLOUDFLARE_API_TOKEN` – the token from step 7
   - `CLOUDFLARE_ACCOUNT_ID` – the id from step 1

9. **Commit the edited `wrangler.jsonc`** (database id and vars are not secrets) and push to `main`. The deploy workflow runs from then on.

10. **Optional – preview deployments for pull requests:** not set up in v1. Preview URLs (`<version>-himbo-mode.<subdomain>.workers.dev`) would share the production D1 database, so they are left out on purpose. A clean option for later is a second Worker environment with its own D1 database.

---

## Deploy flow

- **Pull request / any branch except `main`** → `.github/workflows/ci.yml`: type-check, lint, unit tests, build, Playwright happy path.
- **Push to `main`** → `.github/workflows/deploy.yml`: the same checks, then `wrangler d1 migrations apply DB --remote` and `wrangler deploy`. Without the GitHub secrets, the job skips the deploy with a warning instead of failing.
- **Migrations** are append-only: add a new numbered file in `migrations/`, never edit one that has been applied.

---

## How the game works

All rules are pure, unit-tested functions in `shared/game`, with every tunable number in `shared/game/constants.ts`. The server recalculates everything when a workout is saved, edited or deleted; the client never sends XP.

- **XP per workout:** completed sets (weighted by set type and reps/hold time) + cardio/rugby minutes × intensity (RPE) + streak bonus + personal-best bonus + duration bonus + weekly-goal bonus. Capped at 600 XP per workout and 1 500 XP per day; cardio minutes cannot exceed the workout's real duration.
- **Levels:** XP for level *L* = 100 × (L−1)^1.6, up to level 99, with 16 rank titles from *Couch Potato* to *Himbo Legend*.
- **Weekly streak:** a week counts when the weekly goal (1–7, default 3) is met. Every silver or gold trophy earns a streak freeze (max. 2), used automatically for a missed week.
- **Trophies:** 36 trophies, most with bronze/silver/gold tiers.
- **Personal bests:** heaviest weight, Epley e1RM (≤ 12 reps), most reps, best volume, longest time/distance, fastest pace (≥ 1 km).
- **Quests:** extension point in `shared/game/quests.ts` (not active in v1).

## Privacy

No email is stored. Leaderboards show only username, display name, avatar, level and score, and only for users with *Show me on leaderboards* enabled (default on). Recent workouts on a profile are private by default. Users can export all their data as JSON and delete their account in Settings.
