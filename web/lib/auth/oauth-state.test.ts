import { describe, expect, it } from "vitest";
import { STATE_TTL_SECONDS, sealState, verifyState } from "./oauth-state";

const KEY = "k".repeat(48);
const now = new Date("2026-11-10T12:00:00Z");
const cookie = sealState({ state: "abc", provider: "google" }, KEY, now);

describe("OAuth state cookie", () => {
  it("accepts the matching state for the same provider", () => {
    expect(verifyState(cookie, { state: "abc", provider: "google" }, KEY, now)).toBe(true);
  });

  it.each([
    ["wrong state", { state: "xyz", provider: "google" }],
    ["missing state", { state: null, provider: "google" }],
    ["other provider", { state: "abc", provider: "facebook" }],
  ])("rejects %s", (_, expected) => {
    expect(verifyState(cookie, expected, KEY, now)).toBe(false);
  });

  it("rejects a missing, forged or expired cookie", () => {
    const later = new Date(now.getTime() + STATE_TTL_SECONDS * 1000);
    expect(verifyState(undefined, { state: "abc", provider: "google" }, KEY, now)).toBe(false);
    expect(verifyState(cookie, { state: "abc", provider: "google" }, "x".repeat(48), now)).toBe(false);
    expect(verifyState(cookie, { state: "abc", provider: "google" }, KEY, later)).toBe(false);
  });
});
