import { describe, expect, it } from "vitest";
import { isDevLoginEnabled, publicOrigin } from "./config";

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

describe("dev login gate", () => {
  it("is off unless ALLOW_DEV_LOGIN is exactly 'true'", () => {
    expect(isDevLoginEnabled(env({}))).toBe(false);
    expect(isDevLoginEnabled(env({ ALLOW_DEV_LOGIN: "1" }))).toBe(false);
    expect(isDevLoginEnabled(env({ ALLOW_DEV_LOGIN: "true" }))).toBe(true);
    expect(isDevLoginEnabled(env({ ALLOW_DEV_LOGIN: "true", VERCEL_ENV: "preview" }))).toBe(true);
  });

  it("is never on in production, even if misconfigured", () => {
    expect(isDevLoginEnabled(env({ ALLOW_DEV_LOGIN: "true", VERCEL_ENV: "production" }))).toBe(false);
  });
});

describe("publicOrigin", () => {
  const request = new Request("https://chorebacon-abc123-team.vercel.app/api/v1/auth/google/start");

  it("uses the stable production domain in production (must match registered redirect URIs)", () => {
    expect(publicOrigin(request, env({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "chorebacon.vercel.app" })))
      .toBe("https://chorebacon.vercel.app");
  });

  it("uses the request origin elsewhere", () => {
    expect(publicOrigin(new Request("http://localhost:3000/x"), env({}))).toBe("http://localhost:3000");
    expect(publicOrigin(request, env({ VERCEL_ENV: "preview" }))).toBe("https://chorebacon-abc123-team.vercel.app");
  });
});
