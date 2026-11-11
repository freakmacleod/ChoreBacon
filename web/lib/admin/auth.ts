import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { ADMIN_COOKIE, readAdminSession } from "@/lib/auth/admin-session";
import { jwtSigningKey } from "@/lib/auth/config";
import { findAdmin } from "./catalog";

/** The signed-in admin, or null. The role is read from the database on every call. */
export async function currentAdmin() {
  const userId = readAdminSession((await cookies()).get(ADMIN_COOKIE)?.value, jwtSigningKey(), new Date());
  return userId ? findAdmin(db, userId) : null;
}

/** Use at the top of every admin page section and Server Action: redirects to login unless admin. */
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
