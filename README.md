# ChoreBacon

Gör sysslor, tjäna poäng, lös in belöningar.

ChoreBacon is a .NET 10 MAUI app (Android and iOS) where family members complete chores,
earn points and redeem them for real-life rewards, unlocking achievements along the way.
The chore, reward and achievement catalog is managed in a web admin and served by an API
hosted on Vercel in the EU (Frankfurt).

> **Status:** early development. The app scaffolding (MVVM, pages, local SQLite services)
> exists; the backend, real sign-in and admin GUI are not built yet. See the backlog in
> [CLAUDE.md](CLAUDE.md).

## Repository layout

| Path | What |
|------|------|
| `src/ChoreBacon.App/` | .NET 10 MAUI app |
| `tests/ChoreBacon.App.Tests/` | xUnit v3 tests for the app's shared code |
| `web/` | Next.js admin GUI + REST API *(planned)* |
| `ChoreBacon.slnx` | Solution |

## Prerequisites

- .NET 10 SDK with the MAUI Android workload: `dotnet workload restore src/ChoreBacon.App/ChoreBacon.App.csproj`
- Android SDK + JDK for Android builds (Visual Studio / Rider install these; on the command
  line see <https://aka.ms/dotnet-android-install-sdk>)
- macOS with Xcode for iOS builds
- Node.js 22+ for `web/` (once it exists)

## Build and test

```bash
# Android app
dotnet build src/ChoreBacon.App -f net10.0-android

# Unit tests (no platform SDK needed — they use the app's plain net10.0 target)
dotnet test --project tests/ChoreBacon.App.Tests
```

Tests run on Microsoft.Testing.Platform (configured in `global.json`), so `dotnet test`
takes `--project` / `--solution` rather than a bare path. Running `dotnet test` against the
whole solution also builds the Android target and therefore needs the Android SDK.

## Configuration and secrets

Never commit secrets. Backend secrets live in Vercel environment variables and locally in
`web/.env.local` (gitignored). See [CLAUDE.md](CLAUDE.md#secrets-and-config).
