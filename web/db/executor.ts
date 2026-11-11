import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import type * as schema from "./schema";

/**
 * The app's database or an open transaction (a transaction is a PgDatabase too). Services take this
 * instead of importing `db`, so tests can run them inside a transaction that is rolled back; their
 * own `.transaction()` calls then become savepoints.
 */
export type Executor = PgDatabase<NeonQueryResultHKT, typeof schema>;
