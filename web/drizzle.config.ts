import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Locally, credentials come from `vercel env pull` (.env.local); in CI they are real env vars.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  // Migrations use the direct (unpooled) connection; the app uses the pooled one.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
