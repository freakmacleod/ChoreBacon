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
| DELETE | `/api/v1/me` | Deletes (anonymises) the account → 204; 409 `last_parent` while the only parent of a family with others |
| POST | `/api/v1/facebook/data-deletion` | Facebook's data deletion callback (`signed_request`, verified with the app secret) → `{ url, confirmation_code }` |
| GET | `/api/v1/me/progress` | Balance, lifetime earned, points spent, chores completed, streak, chores done this period / total, 3 latest achievements, `familyName` (null without a family) |
| GET | `/api/v1/chores` | Visible chores, each with `completedThisPeriod` for its current Stockholm window, `isFamilyItem` and `expiresAt` (temporary chores, listed first) |
| POST | `/api/v1/chores/{id}/complete` | 201 `{ completion, pointsEarned, pointsPending, balance, unlockedAchievements, comboBonuses }`; 409 `chore_already_completed_today` / `_this_week` / `_this_month` / `chore_already_completed`, `chore_expired`, `chore_taken` |
| GET | `/api/v1/combos` | Visible combos with each chore's `done`/`pending` for the combo's current Stockholm day or week, and `awardedThisPeriod` |
| GET | `/api/v1/rewards` | Visible rewards; `stock` null = unlimited, 0 = sold out; `isFamilyItem` for the family's own |
| POST | `/api/v1/rewards/{id}/redeem` | 201 `{ redemption, balance, unlockedAchievements }`; 409 `insufficient_points` / `reward_out_of_stock` |
| GET | `/api/v1/achievements` | Active global achievements and the user's family's own (plus any the user already unlocked); `unlockedAt` null while locked, `isFamilyItem` |
| POST | `/api/v1/families` | `{ name }` → 201 family; caller becomes parent. 409 `already_in_family` |
| POST | `/api/v1/families/join` | `{ code }` → family; joins as child. 404 `invalid_invite_code`, 409 `already_in_family` |
| GET / PATCH | `/api/v1/me/family` | Family with members and balances (`inviteCode` for parents only); PATCH `{ name?, requiresApproval? }` (parents). 404 `no_family` |
| POST | `/api/v1/me/family/leave` | 204; 409 `last_parent` while others remain without a parent |
| POST | `/api/v1/me/family/invite-code` | Parents: new code, the old one stops working |
| PATCH / DELETE | `/api/v1/me/family/members/{userId}` | Parents: `{ role }` or remove; 409 `last_parent` |
| GET | `/api/v1/me/family/completions` | Parents: pending completions |
| POST | `/api/v1/me/family/completions/{id}/approve` \| `reject` | Parents: approve (books points and any combo bonus) or reject (frees the slot); 409 `not_pending` |
| GET | `/api/v1/me/family/redemptions` | Parents: redemptions to hand over |
| POST | `/api/v1/me/family/redemptions/{id}/fulfil` | Parents: mark handed over |
| GET / POST | `/api/v1/me/family/chores` \| `rewards` | Parents: the family's catalog view; POST adds a family-only item |
| PATCH | `/api/v1/me/family/chores/{id}` \| `rewards/{id}` | Parents: edit a family-only item |
| PUT | `/api/v1/me/family/chores/{id}/settings` \| `rewards/{id}/settings` | Parents: switch a global item off, override points/cost, set the family's stock |
| PUT / DELETE | `/api/v1/me/devices` | `{ token, platform }` registers this device's FCM token for push; DELETE `{ token }` (before sign-out) → 204 |
| GET / POST | `/api/cron/reminders` | `Authorization: Bearer <CRON_SECRET>` only: sends the current reminder slot. 401 otherwise |

Errors are always `{ "error": { "code", "message" } }`; the app maps `code` to Swedish text.

All endpoints except health, auth and cron need `Authorization: Bearer <access token>`.

## Progress rules

Implemented in `lib/progress/` (`rules.ts` pure, `service.ts` database):

- **Frequency** (rule 2): one completion per user, chore and Stockholm window: day, ISO week (Monday start),
  calendar month, or ever (`once`). Guarded by the partial unique index on `period_key`.
- **Redemption** (rule 4): one transaction locks the user, checks the balance, takes one from stock with
  `stock > 0`, writes the redemption and the ledger entry. Nothing restocks automatically (rule 5).
- **Achievements** (rule 1): points achievements use lifetime earned points, never the balance. Bonuses are
  ledger entries and can cascade into further points achievements. A family's own achievements are seen and
  unlocked only by its current members (on the member's own stats); ones already unlocked stay after leaving.
- **Combos**: all of a combo's chores approved within the same Stockholm day or ISO week pays its bonus once per
  user and period (`combo_awards` unique index; ledger reason `combo_bonus`, which counts as earned points). With
  approval, the window is the day the chore was done, not the day it was approved. A combo is only shown, and only
  pays, while all its chores are visible to the user; global combos hold only global chores.
- **Temporary chores**: a chore with `expires_at` is shown until then and simply disappears if nobody did it (no job
  needed). It is always `once`, and the first family member to do it takes it: from that completion (pending or
  approved) it is gone for the others (`chore_taken`); a rejection frees it again. The chore row is locked while
  completing, so two siblings cannot both take it. Temporary chores cannot be part of a combo.
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

## Push notifications

Android push goes through Firebase Cloud Messaging's HTTP v1 API (`lib/push/`). No Firebase SDK: the service account key
signs a JWT, which Google exchanges for an access token.

- **What is sent:** a new active temporary chore and a new active combo are announced, right after the admin saves them, to the
  family's members (or to every registered device for a global one). Reminders go at **16:00 and 19:00 Stockholm** to children
  and solo users (never parents) who still have undone daily chores, temporary chores due within 24 hours, or a combo they have
  started. Each user gets each slot once (`notification_log`), however often the trigger runs.
- **Devices:** the app registers its FCM token after sign-in, whenever FCM rotates it, and removes it before sign-out. Tokens
  are also removed on account deletion and when FCM reports them dead.
- **Schedule:** Vercel Hobby runs cron jobs at most once a day, so `.github/workflows/reminders.yml` calls `/api/cron/reminders`
  four times each afternoon (covering winter and summer time). The endpoint works out the Stockholm slot itself.
- **Configuration** (Vercel env, production):
  - `FIREBASE_SERVICE_ACCOUNT`: the Firebase service account JSON key, on one line. Without it push is off and nothing is sent.
  - `CRON_SECRET`: at least 32 random characters, also stored as the GitHub Actions secret `CRON_SECRET`. Without it the cron
    endpoint refuses every call and the workflow skips.

## Auth

- Access token: HS256 JWT, 15 min, signed with `JWT_SIGNING_KEY` (separate key per Vercel environment).
- Refresh token: opaque, 60 days, stored only as SHA-256, rotated on every use.
- OAuth redirect URIs registered with Google/Facebook (production + localhost:3000 only):
  `https://chorebacon.vercel.app/api/v1/auth/{provider}/callback`. Preview deployments use dev login.
- Local dev: put `JWT_SIGNING_KEY` and `ALLOW_DEV_LOGIN=true` in `.env.development.local`
  (gitignored, not touched by `vercel env pull`).

## Admin

`/admin` is the admin GUI (Swedish): chores, combos, rewards and achievements (global or one family's), families, and the user list.

- **Sign-in:** the same Google/Facebook flow as the app, started with `/api/v1/auth/{provider}/start?client=admin`. The callback sets
  `cb_admin_session`, a signed HttpOnly cookie valid for 8 hours. Only users with role `admin` get one, and the role is re-read
  from the database on every page section and Server Action. Local and Preview deployments also offer a dev admin login
  (same `ALLOW_DEV_LOGIN` gate as the app's dev login).
- **Deactivate, never delete:** chores, rewards and achievements are switched off rather than deleted, so history keeps its
  references. Inactive items are hidden from the app; inactive achievements never unlock.
- **Icons:** picked from a grid, not typed. The set lives in `lib/icons/catalog-icons.json`, which the app embeds as well, so
  the admin and the app always agree. Only keys from the set are accepted. Keys are stored in the database: add new ones,
  never rename or remove one. A new icon shows in the app after the next app build (older builds show a default).
- **Families:** the Familjer page lists every family. An admin can create a family, add users who are not yet in one (as
  parent or child), change roles and take members out, with the same rules as the app: one family per user, and a family
  with members always keeps a parent. The invite code is shown so someone can join from the app. Parents still tailor the
  catalog and approve chores in the app.
- **Global or family:** each chore, reward and achievement is either global or belongs to one family, picked under
  "Gäller" when it is created. It cannot be changed afterwards (make a new item and deactivate the old one instead).
  The lists show the scope and can be filtered by it (`?scope=global` or a family id).
- **Temporary chores:** tick "Tidsbegränsad" on a chore and set the deadline (Swedish time). It must be in the future when
  created; the list shows it, and "Utgången" afterwards.
- **Combos:** pick two to ten chores, a bonus and day or week. A global combo can only contain global chores; a family's combo
  can also contain the family's own. Changing a combo's chores does not take back bonuses already paid.
- **Stock:** only family rewards have one (global rewards are unlimited); an empty value means unlimited. Changing it is an explicit restock; nothing restocks automatically.
- **Roles:** the first admin is granted with `npm run admin:grant -- --email … --production` after that person has signed in
  once. After that, use the Användare page. An admin cannot remove their own admin role.

## Privacy and account deletion

- Public pages: `/` (home), `/integritet` (privacy policy), `/radera-konto` (how to delete an account, plus the status for a
  `?kod=` confirmation code from the Facebook callback).
- **Deletion = anonymisation:** name, email and provider id are removed, sessions revoked, and the user leaves their family.
  `users.deleted_at` is set. The ledger, completions and redemptions stay, linked to the anonymous row, so totals and
  the append-only ledger stay consistent. Signing in again creates a new account. Deleted users cannot write, use `/me` or
  the admin, even with a still-valid access token.
- A family's last parent must hand over first in the app (409). Facebook's callback cannot be refused: it deletes anyway and
  switches approval off for a family left without parents.
- `account_deletions` keeps only confirmation codes and times, so `/radera-konto?kod=…` can answer.
- **Facebook app settings:** Privacy Policy URL `https://chorebacon.vercel.app/integritet`; Data deletion request URL
  `https://chorebacon.vercel.app/api/v1/facebook/data-deletion`. **Google consent screen:** home page `/` and privacy policy
  `/integritet`.
