# Stadium of Elite

A realtime, live **quiz football** match system. Two teams of eight (five on the
field, three on the bench) race ten questions under a referee who decides what
counts — every accepted answer is a goal.

Built to the specs in [`SoE main plan.md`](./SoE%20main%20plan.md) and following
the standards in [`ai-coding-standards.md`](./ai-coding-standards.md).

## Stack

- **Next.js 16 (App Router, TypeScript, Tailwind v4)** — full-stack
- **PostgreSQL on Neon** via **Prisma**
- **Auth.js (v5, credentials)** — roles: `ADMIN`, `REFEREE`, `PLAYER`
- **Realtime with failover**: Pusher → Ably → polling (details below)

## Roles & flow

| Role    | Can do |
| ------- | ------ |
| Admin (seeded) | Create referee/player accounts, create matches, assign a referee, build the 8-per-team rosters |
| Referee (per match) | Prepare up to 20 questions, pick the 10 played, name 5 starters + captain per team, kick off, run every round (open question, lock answers, award GOAL or NO GOAL), approve captain substitution requests, issue warnings/yellow/red cards, end the match |
| Player | Answer open questions while on the field; bench players wait; the captain can request substitutions |
| Spectator | Anyone with the match code can watch live at `/watch/<CODE>` (no account needed) |

## The match cycle

Question opens → 15s countdown → on-field players lock one answer each →
countdown ends, answers freeze and appear **anonymously** → everyone waits →
referee picks the accepted answer (**⚽ GOAL** — scorer revealed, score updates)
or rules **❌ NO GOAL** (correct answer revealed) → timeline & stats update →
next of the ten questions → full-time summary with scorers, cards, subs and the
whole timeline.

Answer **normalisation** treats `Newton` / `newton` / `NEWTON` as one answer, but
the referee is always the final judge.

## Realtime design (three-layer failover)

The server is the single source of truth. Every state change bumps `Match.version`
and writes a timeline event; clients receive a lightweight ping and **re-fetch the
authoritative snapshot**, so all screens agree even if a broadcast is dropped.

- **Pusher** — used when `PUSHER_*` keys are set (primary)
- **Ably** — used when `ABLY_API_KEY` is set (secondary)
- **Polling** — always runs as a safety net; a dropped broadcast self-heals
  within a few seconds, and it is the only transport when neither provider is
  configured.

Server publish failures are logged and never crash an action.

## Getting started

1. Install: `npm install`
2. Create a Neon project (neon.tech) and copy the **direct** (non-pooler) Prisma connection string — the app relies on interactive transactions that the `-pooler` endpoint cannot carry.
3. `cp .env.example .env`, then fill in:
   - `DATABASE_URL`
   - `AUTH_SECRET` (generate with the command in the example)
   - optional `PUSHER_*` and `NEXT_PUBLIC_PUSHER_*` from pusher.com
   - optional `ABLY_API_KEY` / `NEXT_PUBLIC_ABLY_KEY` from ably.com
4. Create the schema and an admin account:

   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```

   The seed prints the admin email/password (from `SEED_ADMIN_*` in `.env`).

5. `npm run dev` and sign in at `/login`.

Deploy: set the same environment variables on Vercel and run the migration +
seed once (`npx prisma migrate deploy`, then `npm run db:seed`).

## Deploying on Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → import** the repo (framework auto-detected as Next.js — build command `npm run build` is already correct; `postinstall` regenerates the Prisma client).
3. Add these **Environment Variables** in Project → Settings → Environment Variables (Production):
   - `DATABASE_URL` — Neon **direct** (non-pooler) connection string (`?sslmode=require`)
   - `AUTH_SECRET` — long random string
   - `AUTH_URL` — your `https://<project>.vercel.app`
   - `AUTH_TRUST_HOST=true`
   - optional Pusher: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`
   - optional Ably: `ABLY_API_KEY`, `NEXT_PUBLIC_ABLY_KEY`
4. Create the tables once (do this after the first successful deploy or right before it):
   ```bash
   npx prisma migrate deploy   # needs DATABASE_URL set locally too
   npm run db:seed
   ```
5. Redeploy or open the site, then sign in with the seeded admin at `/login`.

Migrations are committed under `prisma/migrations`, so a fresh database is fully
set up by `prisma migrate deploy` — no manual SQL needed.

> **No database/realtime keys handy?** The app still builds and runs: realtime
> automatically falls back to pure polling, and pages render until a DB-backed
> query is needed. Drop real credentials into `.env` and restart to go live.

## Useful scripts

```bash
npm run dev          # dev server
npm run build        # production build (type-checks + lints)
npm run lint
npm run typecheck
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed the admin account
```

## Repository layout

```
prisma/schema.prisma        data model + Prisma seed
src/app                     routes: /login, /admin, /referee, /player,
                            /match/[code], /watch/[code], /api/auth
src/app/actions/*           server actions (auth, admin, match engine)
src/components/ui.tsx       design-system primitives (buttons, cards, fields…)
src/components/match        live arena + realtime hook
src/lib/match/engine.ts     every state transition + guards + timeline
src/lib/match/snapshot.ts   role-aware snapshot the clients render
src/lib/realtime/server.ts  Pusher/Ably publish with failover
```
