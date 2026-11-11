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
| `npm run admin:grant -- --email … [--provider …] [--production] [--revoke]` | Grant or remove the admin role for one user (development unless `--production`) |

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
| GET | `/api/v1/achievements` | Active achievements (plus inactive ones the user has); `unlockedAt` null while locked |
| POST | `/api/v1/families` | `{ name }` → 201 family; caller becomes parent. 409 `already_in_family` |
| POST | `/api/v1/families/join` | `{ code }` → family; joins as child. 404 `invalid_invite_code`, 409 `already_in_family` |
| GET / PATCH | `/api/v1/me/family` | Family with members and balances (`inviteCode` for parents only); PATCH `{ name?, requiresApproval? }` (parents). 404 `no_family` |
| POST | `/api/v1/me/family/leave` | 204; 409 `last_parent` while others remain without a parent |
| POST | `/api/v1/me/family/invite-code` | Parents: new code, the old one stops working |
| PATCH / DELETE | `/api/v1/me/family/members/{userId}` | Parents: `{ role }` or remove; 409 `last_parent` |
| GET | `/api/v1/me/family/completions` | Parents: pending completions |
| POST | `/api/v1/me/family/completions/{id}/approve` \| `reject` | Parents: approve (books points) or reject (frees the slot); 409 `not_pending` |
| GET | `/api/v1/me/family/redemptions` | Parents: redemptions to hand over |
| POST | `/api/v1/me/family/redemptions/{id}/fulfil` | Parents: mark handed over |
| GET / POST | `/api/v1/me/family/chores` \| `rewards` | Parents: the family's catalog view; POST adds a family-only item |
| PATCH | `/api/v1/me/family/chores/{id}` \| `rewards/{id}` | Parents: edit a family-only item |
| PUT | `/api/v1/me/family/chores/{id}/settings` \| `rewards/{id}/settings` | Parents: switch a global item off, override points/cost, set the family's stock |

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
- **Families** (one per user): the creator is a parent; others join with the invite code as children (a parent can
  promote them). Members see global items the family has not switched off, with its point/cost overrides, plus
  family-only items. Solo users see the global catalog.
- **Approval**: when the family requires it, a child's completion is `pending` and earns nothing until a parent
  approves; approval books the points stored at completion time, rejection frees the slot. Parents' own completions
  are approved immediately.
- **Stock is per family**: global rewards are unlimited (a check constraint enforces it); families set stock on their
  settings for a global reward or on their own rewards. Only a parent's explicit change restocks.

`*.db.test.ts` tests run against the `development` branch from `.env.development.local` inside a rolled-back
transaction; they are skipped when that file is missing.

## Auth

- Access token: HS256 JWT, 15 min, signed with `JWT_SIGNING_KEY` (separate key per Vercel environment).
- Refresh token: opaque, 60 days, stored only as SHA-256, rotated on every use.
- OAuth redirect URIs registered with Google/Facebook (production + localhost:3000 only):
  `https://chorebacon.vercel.app/api/v1/auth/{provider}/callback`. Preview deployments use dev login.
- Local dev: put `JWT_SIGNING_KEY` and `ALLOW_DEV_LOGIN=true` in `.env.development.local`
  (gitignored, not touched by `vercel env pull`).

## Admin

`/admin` is the admin GUI (Swedish): global chores, rewards and achievements, and the user list.

- **Sign-in:** the same Google/Facebook flow as the app, started with `/api/v1/auth/{provider}/start?client=admin`. The callback sets
  `cb_admin_session`, a signed HttpOnly cookie valid for 8 hours. Only users with role `admin` get one, and the role is re-read
  from the database on every page section and Server Action. Local and Preview deployments also offer a dev admin login
  (same `ALLOW_DEV_LOGIN` gate as the app's dev login).
- **Deactivate, never delete:** chores, rewards and achievements are switched off rather than deleted, so history keeps its
  references. Inactive items are hidden from the app; inactive achievements never unlock.
- **Stock:** an empty value means unlimited. Changing it is an explicit restock; nothing restocks automatically.
- **Roles:** the first admin is granted with `npm run admin:grant -- --email … --production` after that person has signed in
  once. After that, use the Användare page. An admin cannot remove their own admin role.
