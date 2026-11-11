import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_TTL_SECONDS, readAdminSession, sealAdminSession } from "./admin-session";
import { sealState } from "./oauth-state";
import { seal, unseal } from "./seal";

const KEY = "k".repeat(48);
const now = new Date("2026-11-10T12:00:00Z");

describe("admin session cookie", () => {
  it("names the signed-in user until it expires", () => {
    const cookie = sealAdminSession("user-1", KEY, now);
    expect(readAdminSession(cookie, KEY, now)).toBe("user-1");
    expect(readAdminSession(cookie, KEY, new Date(now.getTime() + ADMIN_SESSION_TTL_SECONDS * 1000))).toBeNull();
  });

  it("rejects forged, tampered and missing cookies", () => {
    const cookie = sealAdminSession("user-1", KEY, now);
    const [body, mac] = cookie.split(".");
    const otherBody = Buffer.from(JSON.stringify({ sub: "user-2", exp: 9_999_999_999 })).toString("base64url");
    expect(readAdminSession(cookie, "x".repeat(48), now)).toBeNull();
    expect(readAdminSession(`${otherBody}.${mac}`, KEY, now)).toBeNull();
    expect(readAdminSession(`${body}.${mac}.x`, KEY, now)).toBeNull();
    expect(readAdminSession(undefined, KEY, now)).toBeNull();
  });

  it("does not accept a token sealed for another purpose", () => {
    const oauthState = sealState({ state: "abc", provider: "google", client: "admin" }, KEY, now);
    expect(readAdminSession(oauthState, KEY, now)).toBeNull();
    expect(unseal("admin-session", seal("oauth-state", { sub: "user-1" }, 60, KEY, now), KEY, now)).toBeNull();
  });
});
