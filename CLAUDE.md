# CLAUDE.md — ChoreBacon

## What this is

ChoreBacon is a .NET 10 MAUI app where users complete chores, earn points, and redeem
points for real-life rewards. Achievements unlock along the way. The chore, reward and
achievement catalog lives in a **global database**, managed through a **web admin GUI**,
and served to the app through an **API**. Admin, API and database are hosted on
**Vercel in an EU region**.

- Target market: **Sweden**. UI language: **Swedish (sv-SE)** first; keep everything localizable.
- Business time zone: **Europe/Stockholm**. Never compute "today" in UTC.
- Platforms: Android and iOS (Windows/Mac Catalyst are not priorities).

## Repository layout (target)

```
/ChoreBacon.slnx                 Solution file (create it — missing today)
/src/ChoreBacon.App/             .NET 10 MAUI app (existing scaffolding + MVVM)
/src/ChoreBacon.Contracts/       Shared DTOs for the API (records), referenced by the app
/tests/ChoreBacon.App.Tests/     xUnit tests for ViewModels and services
/web/                            Next.js (App Router, TypeScript) — admin GUI + REST API, deployed to Vercel
/web/db/                         Drizzle schema + migrations
```

The MAUI project already exists; move it under `/src` only if it is not there yet, and
do it as a separate commit.

## Architecture decisions

### Backend (Vercel)
- Vercel has no first-class .NET runtime, so the API and admin GUI are **one Next.js
  app in TypeScript**. API = route handlers under `web/app/api/v1/...`. Admin = pages under
  `web/app/admin/...`.
- **Database:** Postgres via Neon (Vercel Marketplace), region **AWS eu-central-1 (Frankfurt)**.
- **Function region:** must be pinned next to the database. In `web/vercel.json`:
  ```json
  { "regions": ["fra1"] }
  ```
  Vercel defaults to `iad1` (US East) — never leave that default. If the DB is ever moved
  to a Stockholm-region provider, switch to `arn1` at the same time. App ↔ API ↔ DB should
  all be in the same region.
- ORM: Drizzle. Validation: Zod on every request body. All schema changes go through
  migrations — never edit the production DB by hand.
- The **API is the source of truth** for points, completions, redemptions and achievements.
  The app never decides on its own that points were earned or a reward was bought.

### Auth
- Users sign in with **Google** or **Facebook**.
- Flow: app opens `WebAuthenticator` → `https://<api>/api/v1/auth/{provider}/start` →
  provider OAuth → backend callback → backend upserts user and issues **its own tokens**
  → redirects to `chorebacon://auth#access_token=...&refresh_token=...`.
- Access token: short-lived JWT (~15 min). Refresh token: long-lived, rotated on every use,
  stored hashed in the DB.
- App stores tokens in `SecureStorage` only — never in Preferences or SQLite.
- `chorebacon://` must be registered: Android (`WebAuthenticatorCallbackActivity` with an
  intent filter) and iOS (`CFBundleURLTypes` in `Info.plist`).
- `TryRestoreSessionAsync` runs at startup (before choosing login vs. main shell) and uses the
  refresh token.
- **Dev login:** a `DEBUG`-only "Logga in som testanvändare" button that calls
  `/api/v1/auth/dev` — that endpoint must return 404 unless `ALLOW_DEV_LOGIN=true` and it is
  never enabled in production.
- Admin GUI: same Google/Facebook login (Auth.js), access limited to users with role `admin`.

### Roles and families
- Roles: `admin` (global catalog), `parent`, `child`.
- A **family** groups parents and children. Parents approve completions (optional per family),
  manage which global chores/rewards are active for their family, and can add family-only ones.
- Global catalog items are templates; family-level overrides (points, active/inactive) live in
  separate tables. Do not copy catalog rows into families.

## Data model (core tables)

- `users` (id, provider, provider_user_id, display_name, email, created_at)
- `families`, `family_members` (family_id, user_id, role)
- `chores` (id, title_key/title, description, icon, points, frequency: `daily|weekly|monthly|once`, is_global, family_id?)
- `rewards` (id, title, icon, cost, stock nullable = unlimited, is_active)
- `achievements` (id, code, title, icon, rule_type, threshold)
- `chore_completions` (id, user_id, chore_id, completed_at, local_date, status: `pending|approved|rejected`)
- `point_ledger` (id, user_id, delta, reason, ref_id, created_at) — **append-only**
- `redemptions` (id, user_id, reward_id, cost, created_at, status)
- `user_achievements` (user_id, achievement_id, unlocked_at)

Balance = `SUM(point_ledger.delta)`. Lifetime earned = `SUM(delta) WHERE delta > 0`.

## Business rules (these fix known bugs — do not regress)

1. **"Points earned" achievements use lifetime earned points**, not the current balance.
   Spending in the store must never block an unlock.
2. **Frequency is enforced server-side.** A daily chore once per local day, weekly once per
   ISO week (Monday start), monthly once per calendar month — all in Europe/Stockholm time.
   The API returns `409` with a Swedish-friendly error code if violated.
3. **Dates:** store timestamps as UTC (`timestamptz`), but derive `local_date`, streaks and
   resets in `Europe/Stockholm`. In C# use `TimeProvider` + `TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm")`
   so it is testable.
4. **Redemption is atomic:** one transaction checks balance, decrements stock
   (`UPDATE ... SET stock = stock - 1 WHERE stock > 0`), writes ledger and redemption. Out of
   stock → `409`.
5. **No automatic re-seeding.** Seed data is a one-time migration/script. Never re-add rewards
   because none are "available". Sold-out stays sold out.
6. **Session persistence:** sign-in always updates the session/refresh token for returning users,
   not only new ones.

## MAUI app conventions

- MVVM with **CommunityToolkit.Mvvm** source generators: `[ObservableProperty]` on
  **partial properties** (not fields), `[RelayCommand]` for commands, `ObservableObject` base.
- Navigation: Shell with registered routes; pass parameters via `IQueryAttributable` or query properties.
- DI everything in `MauiProgram.cs`. Pages and ViewModels are transient unless there is a reason.
- API access: a typed client over `IHttpClientFactory` (`AddHttpClient<IChoreBaconApi, ...>`)
  with a `DelegatingHandler` that attaches the bearer token and refreshes on `401`.
- Shared DTOs come from `ChoreBacon.Contracts` (`record` types, `System.Text.Json` source generation).
- **Data loading:** no work in `async void OnStart`. Load data in ViewModels via an
  `InitializeAsync`/`OnAppearing` command, with loading and error states. Pages must render
  correctly before data arrives.
- `async void` only for event handlers. Pass `CancellationToken` through service calls.
- XAML: use `Border`, never `Frame`. Use compiled bindings (`x:DataType`) everywhere.
- Strings: `.resx` resources (`AppResources.resx` = Swedish default, add `AppResources.en.resx` later).
  No hard-coded UI text in XAML or C#.
- Icons: catalog items carry an icon key (e.g. `ach_first`). Map keys to bundled images in
  `Resources/Images` (or a font icon) via a converter — never display the raw key. Fall back
  to a default icon for unknown keys.
- SQLite: the API replaces it as storage. Remove the SQLite repositories once the API path
  works. A local read cache can be reintroduced later if offline support is needed — ask first.

### C# style
- Modern C#: file-scoped namespaces, primary constructors, collection expressions (`[]`),
  `record` for DTOs, pattern matching, `required`/`init` where useful, nullable enabled
  with no warnings suppressed without a comment.
- Prefer `TimeProvider` over `DateTime.Now/UtcNow`.
- Point out and modernize older-style code when touching a file, but keep unrelated
  refactors in separate commits.

## Backlog (in priority order)

1. **Repo hygiene:** add `.gitignore` (Visual Studio + Node + Vercel), remove committed
   `obj/` and `bin/` (`git rm -r --cached`), add `ChoreBacon.slnx`, `README.md`, test project.
2. **Template leftovers:** delete unused `MainPage`; replace app ID `com.companyname.chorebacon`
   (ask for final ID before changing — it is hard to change after store release); replace
   default purple icon and splash.
3. **Backend skeleton:** Next.js app in `/web`, Neon DB in Frankfurt, `fra1` region, Drizzle
   schema + migrations, seed script, health endpoint.
4. **Auth end to end:** Google + Facebook in backend, `WebAuthenticator` in app, URL scheme
   registration, session restore, dev login. This unblocks everything else.
5. **API for catalog + progress:** chores, rewards, achievements, completions, redemptions,
   balance — replace SQLite usage in the app.
6. **Admin GUI:** CRUD for global chores, rewards, achievements; user list.
7. **Families and parent features:** invite/join family, parent approval, family overrides.
8. **Missing images:** `tab_*.png` and `chorebacon_logo.png` (placeholders are fine until real artwork exists).

## Commands

```bash
# App
dotnet build src/ChoreBacon.App -f net10.0-android
dotnet test

# Web / API
cd web
npm install
npm run dev
npm run db:generate   # drizzle migration from schema
npm run db:migrate
npm run lint && npm run typecheck
```

## Secrets and config

- Never commit secrets. Backend secrets live in Vercel environment variables
  (`DATABASE_URL`, `JWT_SIGNING_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`,
  `ALLOW_DEV_LOGIN`), locally in `web/.env.local` (gitignored).
- The app's API base URL comes from build configuration (Debug → preview/local, Release → production).

## Working agreements for Claude

- Ask before: changing the app ID, changing DB region, adding a new major dependency,
  deleting data or migrations.
- Every new business rule gets a test (xUnit in the app, Vitest in `/web`).
- Keep commits small and focused; one backlog item per branch.
- When unsure whether something is global-catalog or family-level, ask.
