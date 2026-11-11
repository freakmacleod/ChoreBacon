import { randomInt } from "node:crypto";

// Invite codes: 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L), shown as XXXX-XXXX.
// 31^8 ≈ 8.5·10^11 combinations. Stored normalised (upper case, no dash).

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

export function newInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Accepts what people type ("k7pq 4xmr", "K7PQ-4XMR"); null if it cannot be a code. */
export function normalizeInviteCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return code.length === INVITE_CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

export const formatInviteCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
