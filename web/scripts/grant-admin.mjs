// Grants (or with --revoke, removes) the global admin role for one user.
//
//   npm run admin:grant -- --email anna@example.se [--provider google] [--production] [--revoke]
//   npm run admin:grant -- --id <user uuid> [--production]
//
// Targets the Neon development branch (.env.development.local) unless --production is given, which
// uses .env.local (from `vercel env pull`). The user must have signed in once so the row exists.
// After the first admin exists, roles are managed on /admin/users instead.
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { Pool } from "@neondatabase/serverless";

const { values: args } = parseArgs({
  options: {
    email: { type: "string" },
    id: { type: "string" },
    provider: { type: "string" },
    production: { type: "boolean", default: false },
    revoke: { type: "boolean", default: false },
  },
});

if (!args.email === !args.id) {
  console.error("Give exactly one of --email or --id.");
  process.exit(2);
}

for (const file of args.production ? [".env.local"] : [".env.development.local", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL found.");
  process.exit(2);
}

const pool = new Pool({ connectionString: url });
try {
  const where = [];
  const params = [];
  if (args.id) where.push(`id = $${params.push(args.id)}`);
  if (args.email) where.push(`lower(email) = lower($${params.push(args.email)})`);
  if (args.provider) where.push(`provider = $${params.push(args.provider)}`);

  const { rows } = await pool.query(`select id, provider, display_name, role from users where ${where.join(" and ")}`, params);
  if (rows.length !== 1) {
    console.error(rows.length === 0 ? "No matching user (has the account signed in once?)." : "Several users match; add --provider or use --id:");
    for (const r of rows) console.error(`  ${r.id}  ${r.provider}  ${r.display_name}  ${r.role}`);
    process.exit(1);
  }

  const role = args.revoke ? "user" : "admin";
  const [user] = rows;
  await pool.query("update users set role = $1 where id = $2", [role, user.id]);
  const target = args.production ? "PRODUCTION" : "development";
  console.log(`${target}: ${user.display_name} (${user.provider}, ${user.id}) role ${user.role} -> ${role}`);
} finally {
  await pool.end();
}
