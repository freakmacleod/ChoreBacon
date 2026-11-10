import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// WebSocket pool (not neon-http) so business rules can use interactive transactions,
// e.g. atomic redemption: check balance → decrement stock → write ledger + redemption.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ client: pool, schema });
