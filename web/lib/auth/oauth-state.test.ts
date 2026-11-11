import { describe, expect, it } from "vitest";
import { STATE_TTL_SECONDS, readState, sealState } from "./oauth-state";

const KEY = "k".repeat(48);
const now = new Date("2026-11-10T12:00:00Z");
const cookie = sealState({ state: "abc", provider: "google", client: "app" }, KEY, now);

describe("OAuth state cookie", () => {
  it("accepts the matching state for the same provider and remembers the client", () => {
    expect(readState(cookie, { state: "abc", provider: "google" }, KEY, now)).toBe("app");
    const admin = sealState({ state: "abc", provider: "google", client: "admin" }, KEY, now);
    expect(readState(admin, { state: "abc", provider: "google" }, KEY, now)).toBe("admin");
  });

  it.each([
    ["wrong state", { state: "xyz", provider: "google" }],
    ["missing state", { state: null, provider: "google" }],
    ["other provider", { state: "abc", provider: "facebook" }],
  ])("rejects %s", (_, expected) => {
    expect(readState(cookie, expected, KEY, now)).toBeNull();
  });

  it("rejects a missing, forged or expired cookie", () => {
    const later = new Date(now.getTime() + STATE_TTL_SECONDS * 1000);
    expect(readState(undefined, { state: "abc", provider: "google" }, KEY, now)).toBeNull();
    expect(readState(cookie, { state: "abc", provider: "google" }, "x".repeat(48), now)).toBeNull();
    expect(readState(cookie, { state: "abc", provider: "google" }, KEY, later)).toBeNull();
  });
});
