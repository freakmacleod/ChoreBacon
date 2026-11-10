import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "./jwt";

const KEY = "k".repeat(48);
const now = new Date("2026-11-10T12:00:00Z");
const token = signAccessToken({ sub: "user-1", role: "user" }, KEY, 900, now);

describe("access tokens", () => {
  it("round-trips claims while valid", () => {
    expect(verifyAccessToken(token, KEY, now)).toMatchObject({ sub: "user-1", role: "user", iss: "chorebacon" });
  });

  it("expires after the TTL", () => {
    expect(verifyAccessToken(token, KEY, new Date(now.getTime() + 899_000))).not.toBeNull();
    expect(verifyAccessToken(token, KEY, new Date(now.getTime() + 900_000))).toBeNull();
  });

  it("rejects a different signing key", () => {
    expect(verifyAccessToken(token, "x".repeat(48), now)).toBeNull();
  });

  it("rejects a tampered payload (e.g. privilege escalation)", () => {
    const [h, p, s] = token.split(".");
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...claims, role: "admin" })).toString("base64url");
    expect(verifyAccessToken(`${h}.${forged}.${s}`, KEY, now)).toBeNull();
  });

  it("rejects alg=none and malformed tokens", () => {
    const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const [, p] = token.split(".");
    expect(verifyAccessToken(`${none}.${p}.`, KEY, now)).toBeNull();
    expect(verifyAccessToken("not-a-jwt", KEY, now)).toBeNull();
  });
});
