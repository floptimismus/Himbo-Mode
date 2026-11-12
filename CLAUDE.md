# Himbo-Mode – project guide

Gamified, mobile-first workout tracker PWA. 8-bit pixel-art content under Apple-style "Liquid Glass" chrome.

## Stack

- **Frontend** (`src/`): React 19 + TypeScript + Vite, Tailwind CSS v4 (tokens as CSS variables), React Router, TanStack Query, Zustand (live workout, outbox, prefs).
- **Backend** (`worker/`): one Cloudflare Worker (Static Assets + API under `/api/*`), Hono + Zod.
- **Shared** (`shared/`): pure logic and data used by both sides – game rules, Zod schemas, exercise library, units.
- **Database**: Cloudflare D1, plain typed SQL (no ORM), migrations in `migrations/`.
- **Auth**: passkeys via `@simplewebauthn/*`, hashed recovery codes, session cookie (`HttpOnly`, `SameSite=Lax`), sessions in D1.
- **Tests**: Vitest (`tests/unit`, pure logic only), Playwright (`tests/e2e`, happy path with a virtual authenticator).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with the Worker running in workerd (http://localhost:5173) |
| `npm run db:migrate:local` | Apply D1 migrations to the local database (`.wrangler/`) |
| `npm run check` | typecheck + lint + unit tests (run before every commit) |
| `npm run e2e` | Playwright happy path (starts the dev server itself) |
| `npm run seed:gen` | Regenerate `migrations/0002_seed_exercises.sql` from `shared/data/exercises` |
| `npm run icons` | Regenerate `assets/icon.svg` and all PNG icons in `public/icons` |
| `npm run build` / `npm run deploy` | Production build / build + `wrangler deploy` |

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess`. Relative imports carry the `.ts`/`.tsx` extension; `@/` = `src/`, `@shared/` = `shared/`.
- **Server is authoritative.** The client never sends XP, PBs, levels or trophies. `worker/services/game.ts` recomputes them with the pure functions in `shared/game`.
- **All gamification rules are pure functions** in `shared/game` with unit tests. Tunable numbers live in `shared/game/constants.ts` – change them there, never inline.
- Storage units: weight in **kg**, distance in **metres**, durations in **seconds**, timestamps in **ms**. Convert only at the UI edge (`shared/units.ts`).
- Weeks start on Monday in the user's local time; a week is identified by its Monday as `YYYY-MM-DD`.
- API input is validated with the Zod schemas in `shared/schemas.ts`; plausibility caps are in `shared/game/constants.ts` (`LIMITS`).
- SQL lives in `worker/routes/*` and `worker/services/*`; always scope queries by `user_id`.
- **No hard-coded UI strings.** Every string goes into `src/i18n/en.ts` and `src/i18n/de.ts` (the `de` type forces the same keys). Exercise and trophy texts are localized in their data files.
- When adding a system exercise: edit `shared/data/exercises/*`, run `npm run seed:gen`, and add the generated SQL as a **new** migration (never edit an applied migration).

## Design rules

- Two layers, on purpose: **pixel world** for content (cards, bars, sprites, numbers) and **liquid glass** for chrome (nav bar, tab bar, sheets, modals, floating buttons). Do not put glass on content cards or pixel borders on chrome.
- Colors only through tokens (`src/styles/tokens.css`, exposed to Tailwind as `bg-surface`, `text-ink`, …). Light = sunny handheld, dark = night arcade. Both themes must be checked for every screen.
- Pixel art is original, drawn as character grids and rendered with `<PixelSprite />` (SVG rects, `shape-rendering: crispEdges`). No third-party sprites or IP.
- Fonts: `font-pixel` (Press Start 2P) for headings, badges and big numbers; body, inputs and set tables use Inter with `tabular-nums`. Fonts are self-hosted through `@fontsource`.
- Sprite/bar animations use `steps()`; glass sheets use the spring easing token. Everything honours `prefers-reduced-motion`.
- Tap targets ≥ 44px, visible focus ring, safe-area insets, state never conveyed by color alone (add icon or text).
