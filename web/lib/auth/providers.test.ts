import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderNotConfiguredError, providers } from "./providers";

const params = { redirectUri: "https://example.test/api/v1/auth/google/callback", state: "s" };

describe("provider configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports missing credentials as ProviderNotConfiguredError (Preview has none)", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("FACEBOOK_APP_ID", "");
    expect(() => providers.google.authorizeUrl(params)).toThrow(ProviderNotConfiguredError);
    expect(() => providers.facebook.authorizeUrl(params)).toThrow(ProviderNotConfiguredError);
  });

  it("builds the consent URL when configured", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-123");
    const url = new URL(providers.google.authorizeUrl(params));
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(params.redirectUri);
    expect(url.searchParams.get("state")).toBe("s");
  });
});
