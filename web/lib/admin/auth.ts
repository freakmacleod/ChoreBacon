import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/db";
import { ADMIN_COOKIE, readAdminSession } from "@/lib/auth/admin-session";
import { jwtSigningKey } from "@/lib/auth/config";
import { findAdmin } from "./catalog";

/** The signed-in admin, or null. The role is read from the database on every call. */
export async function currentAdmin() {
  // The expiry check needs the current time. Cookies alone may still be read while prerendering
  // (Cache Components), so wait for the real request before calling new Date().
  await connection();
  const userId = readAdminSession((await cookies()).get(ADMIN_COOKIE)?.value, jwtSigningKey(), new Date());
  return userId ? findAdmin(db, userId) : null;
}

/** Use at the top of every admin page section and Server Action: redirects to login unless admin. */
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
