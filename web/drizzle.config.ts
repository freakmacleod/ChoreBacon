import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Locally, credentials come from env files; in CI they are real env vars (which always win).
// .env.development.local points at the Neon "development" branch and is loaded first, so
// local migrations never touch production. `npm run db:migrate:production` skips it and uses
// .env.local (from `vercel env pull`, i.e. the production database).
const useProduction = process.env.CHOREBACON_DB === "production";
for (const file of useProduction ? [".env.local"] : [".env.development.local", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  // Migrations use the direct (unpooled) connection; the app uses the pooled one.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
