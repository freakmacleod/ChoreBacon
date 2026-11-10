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

## Scripts

| Script | What |
|--------|------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:generate` | Generate a migration from `db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations (uses `DATABASE_URL_UNPOOLED`) |

## Database

- Schema: `db/schema.ts`. Migrations: `db/migrations/` — never edit the DB by hand.
- `0001_ledger_append_only` installs triggers that reject UPDATE/DELETE/TRUNCATE on `point_ledger`.
- `0002_seed_catalog` is the one-time seed of the global catalog (Swedish). There is no re-seed script.
- Dates: timestamps are stored as UTC; `local_date` and `period_key` are derived in Europe/Stockholm by
  `lib/stockholm-time.ts`.

## Endpoints

| Method | Path | |
|--------|------|-|
| GET | `/api/v1/health` | `{ status, db, region }`; 503 if the DB is unreachable |
| GET | `/api/v1/auth/{google\|facebook}/start` | Opened by the app's WebAuthenticator; redirects to the provider |
| GET | `/api/v1/auth/{google\|facebook}/callback` | Provider redirect target; ends at `chorebacon://auth#access_token=…&refresh_token=…&expires_in=…` (or `#error=…`) |
| POST | `/api/v1/auth/refresh` | `{ refresh_token }` → new token pair (rotation; reuse revokes the session) |
| POST | `/api/v1/auth/logout` | `{ refresh_token }` → 204, revokes the session |
| POST | `/api/v1/auth/dev` | `{ name? }` → token pair. **404 unless `ALLOW_DEV_LOGIN=true`; always 404 in production** |
| GET | `/api/v1/me` | Bearer → `{ id, provider, displayName, email, role }` |

Errors are always `{ "error": { "code", "message" } }`; the app maps `code` to Swedish text.

## Auth

- Access token: HS256 JWT, 15 min, signed with `JWT_SIGNING_KEY` (separate key per Vercel environment).
- Refresh token: opaque, 60 days, stored only as SHA-256, rotated on every use.
- OAuth redirect URIs registered with Google/Facebook (production + localhost:3000 only):
  `https://chorebacon.vercel.app/api/v1/auth/{provider}/callback`. Preview deployments use dev login.
- Local dev: put `JWT_SIGNING_KEY` and `ALLOW_DEV_LOGIN=true` in `.env.development.local`
  (gitignored, not touched by `vercel env pull`).
