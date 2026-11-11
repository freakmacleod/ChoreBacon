"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import * as catalog from "@/lib/admin/catalog";
import { type FieldErrors, achievementInput, choreInput, parseForm, rewardInput, roleInput } from "@/lib/admin/schemas";
import { ADMIN_COOKIE, adminCookieOptions, sealAdminSession } from "@/lib/auth/admin-session";
import { isDevLoginEnabled, jwtSigningKey } from "@/lib/auth/config";
import { upsertUser } from "@/lib/auth/session";
import { sv } from "./strings";

// Every action re-checks the admin role itself: Server Actions are reachable by direct POST.

export type FormState = { errors?: FieldErrors };

const idOf = (form: FormData) => {
  const id = form.get("id");
  return typeof id === "string" && id !== "" ? id : null;
};

// ── Session ──────────────────────────────────────────────────────────────────

export async function logout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/" });
  redirect("/admin/login");
}

/** Local/preview only (same gate as the app's dev login): signs in a test user with role admin. */
export async function devAdminLogin() {
  if (!isDevLoginEnabled()) redirect("/admin/login");
  const user = await upsertUser({ provider: "dev", providerUserId: "testadmin", displayName: "Testadmin", email: null });
  await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
  (await cookies()).set(ADMIN_COOKIE, sealAdminSession(user.id, jwtSigningKey(), new Date()), adminCookieOptions(process.env.VERCEL === "1"));
  redirect("/admin");
}

// ── Catalog ──────────────────────────────────────────────────────────────────

export async function saveChore(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(choreInput, form);
  if (!parsed.ok) return { errors: parsed.errors };
  const id = idOf(form);
  if (id) {
    if (!(await catalog.updateChore(db, id, parsed.data))) return { errors: { form: sv.common.notFound } };
  } else {
    await catalog.createChore(db, parsed.data);
  }
  redirect("/admin/chores");
}

export async function saveReward(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(rewardInput, form);
  if (!parsed.ok) return { errors: parsed.errors };
  const id = idOf(form);
  if (id) {
    if (!(await catalog.updateReward(db, id, parsed.data))) return { errors: { form: sv.common.notFound } };
  } else {
    await catalog.createReward(db, parsed.data);
  }
  redirect("/admin/rewards");
}

export async function saveAchievement(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(achievementInput, form);
  if (!parsed.ok) return { errors: parsed.errors };
  const id = idOf(form);
  const result = id ? await catalog.updateAchievement(db, id, parsed.data) : await catalog.createAchievement(db, parsed.data);
  if (!result.ok)
    return { errors: result.reason === "duplicate_code" ? { code: sv.achievements.duplicateCode } : { form: sv.common.notFound } };
  redirect("/admin/achievements");
}

async function toggle(form: FormData, fn: (exec: typeof db, id: string, active: boolean) => Promise<boolean>) {
  await requireAdmin();
  const id = idOf(form);
  if (id) await fn(db, id, form.get("active") === "true");
  refresh();
}

export async function setChoreActive(form: FormData) {
  await toggle(form, catalog.setChoreActive);
}

export async function setRewardActive(form: FormData) {
  await toggle(form, catalog.setRewardActive);
}

export async function setAchievementActive(form: FormData) {
  await toggle(form, catalog.setAchievementActive);
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function setUserRole(form: FormData) {
  const admin = await requireAdmin();
  const id = idOf(form);
  const parsed = roleInput.safeParse({ role: form.get("role") });
  if (!id || !parsed.success) return;
  const result = await catalog.setUserRole(db, admin.id, id, parsed.data.role);
  if (!result.ok && result.reason === "cannot_demote_self") redirect("/admin/users?error=cannot_demote_self");
  refresh();
}
