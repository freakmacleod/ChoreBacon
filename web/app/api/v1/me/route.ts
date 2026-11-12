import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { deleteAccount } from "@/lib/account/delete";
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
    .where(and(eq(users.id, claims.sub), isNull(users.deletedAt)));
  if (!user) return apiError(401, "unauthorized", "User no longer exists");

  return Response.json(user, { headers: { "cache-control": "no-store" } });
}

/** Deletes (anonymises) the caller's account; 204, or 409 last_parent while they are their family's only parent. */
export async function DELETE(request: Request) {
  const claims = authenticate(request);
  if (!claims) return apiError(401, "unauthorized", "Missing or invalid access token");
  const result = await deleteAccount(db, claims.sub, new Date());
  if (!result.ok) return apiError(result.status, result.code, result.message);
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
