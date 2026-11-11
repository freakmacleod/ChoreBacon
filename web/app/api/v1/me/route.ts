import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authenticate } from "@/lib/auth/bearer";
import { apiError } from "@/lib/http";

export async function GET(request: Request) {
  const claims = authenticate(request);
  if (!claims) return apiError(401, "unauthorized", "Missing or invalid access token");

  const [user] = await db
    .select({
      id: users.id,
      provider: users.provider,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, claims.sub));
  if (!user) return apiError(401, "unauthorized", "User no longer exists");

  return Response.json(user, { headers: { "cache-control": "no-store" } });
}
