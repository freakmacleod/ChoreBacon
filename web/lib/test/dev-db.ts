import { existsSync, readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { Executor } from "../../db/executor";
import * as schema from "../../db/schema";

// Database tests run against the Neon "development" branch from .env.development.local, inside a
// transaction that is always rolled back. They are skipped when that file is missing (e.g. CI), and
// refuse to run if it points at the same database as .env.local (production).

function readEnv(file: string, key: string): string | undefined {
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).replace(/^"|"$/g, "");
}

const devUrl = readEnv(".env.development.local", "DATABASE_URL_UNPOOLED");
const prodUrl = readEnv(".env.local", "DATABASE_URL_UNPOOLED");
if (devUrl && devUrl === prodUrl) throw new Error("Refusing to run database tests against production");

export const hasDevDatabase = devUrl !== undefined;

class Rollback extends Error {}

let pool: Pool | undefined;

/** Runs `fn` in a transaction on the development branch and rolls everything back afterwards. */
export async function inRollback(fn: (tx: Executor) => Promise<void>): Promise<void> {
  pool ??= new Pool({ connectionString: devUrl });
  const testDb = drizzle({ client: pool, schema });
  try {
    await testDb.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

export async function closeDevDatabase() {
  await pool?.end();
  pool = undefined;
}
