import { describe, expect, it } from "vitest";
import { isCronRequest } from "./cron-auth";

const secret = "s".repeat(40);
const request = (authorization?: string) => new Request("https://x/api/cron/reminders", { headers: authorization ? { authorization } : {} });

describe("cron endpoint auth", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isCronRequest(request(`Bearer ${secret}`), secret)).toBe(true);
    expect(isCronRequest(request(`Bearer ${secret}x`), secret)).toBe(false);
    expect(isCronRequest(request("Bearer nope"), secret)).toBe(false);
    expect(isCronRequest(request(), secret)).toBe(false);
  });

  it("stays closed without a (long enough) secret configured", () => {
    expect(isCronRequest(request("Bearer "), undefined)).toBe(false);
    expect(isCronRequest(request("Bearer short"), "short")).toBe(false);
  });
});
