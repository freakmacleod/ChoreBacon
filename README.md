# ChoreBacon

Gör sysslor, tjäna poäng, lös in belöningar.

ChoreBacon is a .NET 10 MAUI app (Android and iOS) where family members complete chores,
earn points and redeem them for real-life rewards, unlocking achievements along the way.
The chore, reward and achievement catalog is managed in a web admin and served by an API
hosted on Vercel in the EU (Frankfurt).

> **Status:** early development. Sign-in (Google, Facebook), the API for chores, rewards, achievements
> and progress, the admin GUI (`/admin`) and families (invite codes, parent approval, family catalog and
> stock) work end to end; the app keeps no local database. See the backlog in [CLAUDE.md](CLAUDE.md).

## Repository layout

| Path | What |
|------|------|
| `src/ChoreBacon.App/` | .NET 10 MAUI app |
| `tests/ChoreBacon.App.Tests/` | xUnit v3 tests for the app's shared code |
| `src/ChoreBacon.Contracts/` | Shared API DTOs (records, source-generated JSON) |
| `web/` | Next.js REST API (admin GUI planned) |
| `ChoreBacon.slnx` | Solution |

## Prerequisites

- .NET 10 SDK with the MAUI Android workload: `dotnet workload restore src/ChoreBacon.App/ChoreBacon.App.csproj`
- Android SDK + JDK for Android builds (Visual Studio / Rider install these; on the command
  line see <https://aka.ms/dotnet-android-install-sdk>)
- macOS with Xcode for iOS builds
- Node.js 22+ for `web/`

## Build and test

```bash
# Android app
dotnet build src/ChoreBacon.App -f net10.0-android

# Unit tests (no platform SDK needed — they use the app's plain net10.0 target)
dotnet test --project tests/ChoreBacon.App.Tests
```

### Which API the app talks to

The API base URL is set at build time (`ChoreBaconApiBaseUrl`): Debug → local dev server
(`http://10.0.2.2:3000/` on the Android emulator, `http://localhost:3000/` elsewhere), Release →
`https://chorebacon.vercel.app/`. Debug builds show a **"Logga in som testanvändare"** button that uses
the API's dev login. Real Google/Facebook sign-in only works against production or `localhost:3000`
(the registered redirect URIs), e.g.:

```bash
dotnet build src/ChoreBacon.App -f net10.0-android -p:ChoreBaconApiBaseUrl=https://chorebacon.vercel.app/
```

Tests run on Microsoft.Testing.Platform (configured in `global.json`), so `dotnet test`
takes `--project` / `--solution` rather than a bare path. Running `dotnet test` against the
whole solution also builds the Android target and therefore needs the Android SDK.

## Configuration and secrets

Never commit secrets. Backend secrets live in Vercel environment variables and locally in
`web/.env.local` (gitignored). See [CLAUDE.md](CLAUDE.md#secrets-and-config).

### Push notifications (Android)

Push uses Firebase Cloud Messaging. The app's Firebase config is **not** in the repo (it identifies the owner's Firebase
project). To build with push, download `google-services.json` for the Android app `se.ictor.chorebacon` from the Firebase
console and put it at `src/ChoreBacon.App/Platforms/Android/google-services.json` (gitignored). Without it the app builds
and works as before, just without push. Server-side setup: see [web/README.md](web/README.md#push-notifications).

