import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";

export async function GET() {
  // The DB check must run per request, never be prerendered at build time.
  await connection();

  const region = process.env.VERCEL_REGION ?? "local";
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok", region });
  } catch (error) {
    console.error("Health check: database unreachable", error);
    return Response.json({ status: "degraded", db: "unreachable", region }, { status: 503 });
  }
}
