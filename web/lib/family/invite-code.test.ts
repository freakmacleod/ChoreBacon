import { describe, expect, it } from "vitest";
import { INVITE_CODE_LENGTH, formatInviteCode, newInviteCode, normalizeInviteCode } from "./invite-code";

describe("invite codes", () => {
  it("generates 8 unambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = newInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code).not.toMatch(/[01OIL]/);
      expect(normalizeInviteCode(code)).toBe(code);
    }
  });

  it("accepts what people type and rejects what cannot be a code", () => {
    expect(normalizeInviteCode("k7pq-4xmr")).toBe("K7PQ4XMR");
    expect(normalizeInviteCode(" K7PQ 4XMR ")).toBe("K7PQ4XMR");
    expect(normalizeInviteCode("K7PQ-4XM")).toBeNull();
    expect(normalizeInviteCode("K7PQ-4XM0")).toBeNull(); // 0 is not in the alphabet
  });

  it("formats for display", () => {
    expect(formatInviteCode("K7PQ4XMR")).toBe("K7PQ-4XMR");
  });
});
