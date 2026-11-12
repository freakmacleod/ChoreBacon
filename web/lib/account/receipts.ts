import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import { accountDeletions } from "../../db/schema";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A confirmation code for a deletion request, shown to the person (e.g. via Facebook). */
export function newConfirmationCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export async function recordDeletion(exec: Executor, code: string, now: Date) {
  await exec.insert(accountDeletions).values({ code, requestedAt: now, completedAt: now });
}

export async function findDeletion(exec: Executor, code: string) {
  const [receipt] = await exec.select().from(accountDeletions).where(eq(accountDeletions.code, code.trim().toUpperCase()));
  return receipt ?? null;
}
