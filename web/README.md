# ChoreBacon web — API + admin

Next.js (App Router, TypeScript) app that serves the ChoreBacon REST API (`app/api/v1/...`) and,
later, the admin GUI (`app/admin/...`). Deployed to Vercel project `chorebacon`, functions pinned to
`fra1` (Frankfurt) next to the Neon Postgres database in AWS eu-central-1.

## Setup

```bash
npm install
vercel link --project chorebacon   # once per machine
vercel env pull                    # writes .env.local (gitignored)
npm run dev
```

`.env.local` from `vercel env pull` holds the **production** database URL. For local work, put the
Neon `development` branch in `.env.development.local` (gitignored, never overwritten by `vercel env pull`,
and it takes precedence over `.env.local` in both `next dev` and drizzle-kit):

```bash
# connection strings for the development branch (pooled and direct)
npx neonctl connection-string development --pooled   # -> DATABASE_URL
npx neonctl connection-string development            # -> DATABASE_URL_UNPOOLED
```

## Scripts

| Script | What |
|--------|------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:generate` | Generate a migration from `db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to the **development** branch (`.env.development.local`) |
| `npm run db:migrate:production` | Apply pending migrations to **production** (`.env.local` only) |

## Database

- Neon project `chorebacon-db` (AWS eu-central-1) has two branches: `main` = production, `development` =
  local dev and Vercel Preview/Development. Run new migrations on `development` first, then on production.
- Schema: `db/schema.ts`. Migrations: `db/migrations/` — never edit the DB by hand.
- `0001_ledger_append_only` installs triggers that reject UPDATE/DELETE/TRUNCATE on `point_ledger`.
- `0002_seed_catalog` is the one-time seed of the global catalog (Swedish). There is no re-seed script.
- Dates: timestamps are stored as UTC; `local_date` and `period_key` are derived in Europe/Stockholm by
  `lib/stockholm-time.ts`.

## Endpoints

| Method | Path | |
|--------|------|-|
| GET | `/api/v1/health` | `{ status, db, region }`; 503 if the DB is unreachable |
| GET | `/api/v1/auth/{google\|facebook}/start` | Opened by the app's WebAuthenticator; redirects to the provider. 503 `provider_not_configured` where the provider has no credentials (Preview) |
| GET | `/api/v1/auth/{google\|facebook}/callback` | Provider redirect target; ends at `chorebacon://auth#access_token=…&refresh_token=…&expires_in=…` (or `#error=…`) |
| POST | `/api/v1/auth/refresh` | `{ refresh_token }` → new token pair (rotation; reuse revokes the session) |
| POST | `/api/v1/auth/logout` | `{ refresh_token }` → 204, revokes the session |
| POST | `/api/v1/auth/dev` | `{ name? }` → token pair. **404 unless `ALLOW_DEV_LOGIN=true`; always 404 in production** |
| GET | `/api/v1/me` | Bearer → `{ id, provider, displayName, email, role }` |
| GET | `/api/v1/me/progress` | Balance, lifetime earned, points spent, chores completed, streak, chores done this period / total, 3 latest achievements |
| GET | `/api/v1/chores` | Active chores, each with `completedThisPeriod` for its current Stockholm window |
| POST | `/api/v1/chores/{id}/complete` | 201 `{ completion, pointsEarned, balance, unlockedAchievements }`; 409 `chore_already_completed_today` / `_this_week` / `_this_month` / `chore_already_completed` |
| GET | `/api/v1/rewards` | Active rewards; `stock` null = unlimited, 0 = sold out |
| POST | `/api/v1/rewards/{id}/redeem` | 201 `{ redemption, balance, unlockedAchievements }`; 409 `insufficient_points` / `reward_out_of_stock` |
| GET | `/api/v1/achievements` | All achievements; `unlockedAt` null while locked |

Errors are always `{ "error": { "code", "message" } }`; the app maps `code` to Swedish text.

All endpoints except health and auth need `Authorization: Bearer <access token>`.

## Progress rules

Implemented in `lib/progress/` (`rules.ts` pure, `service.ts` database):

- **Frequency** (rule 2): one completion per user, chore and Stockholm window: day, ISO week (Monday start),
  calendar month, or ever (`once`). Guarded by the partial unique index on `period_key`.
- **Redemption** (rule 4): one transaction locks the user, checks the balance, takes one from stock with
  `stock > 0`, writes the redemption and the ledger entry. Nothing restocks automatically (rule 5).
- **Achievements** (rule 1): points achievements use lifetime earned points, never the balance. Bonuses are
  ledger entries and can cascade into further points achievements.
- **Streak**: consecutive Stockholm days with a completion, ending today or yesterday.
- Until families exist, users see the active global catalog and completions are approved immediately.

`*.db.test.ts` tests run against the `development` branch from `.env.development.local` inside a rolled-back
transaction; they are skipped when that file is missing.

## Auth

- Access token: HS256 JWT, 15 min, signed with `JWT_SIGNING_KEY` (separate key per Vercel environment).
- Refresh token: opaque, 60 days, stored only as SHA-256, rotated on every use.
- OAuth redirect URIs registered with Google/Facebook (production + localhost:3000 only):
  `https://chorebacon.vercel.app/api/v1/auth/{provider}/callback`. Preview deployments use dev login.
- Local dev: put `JWT_SIGNING_KEY` and `ALLOW_DEV_LOGIN=true` in `.env.development.local`
  (gitignored, not touched by `vercel env pull`).
