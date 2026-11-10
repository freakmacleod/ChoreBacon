import { describe, expect, it } from "vitest";
import { appRedirect } from "./responses";

describe("appRedirect", () => {
  it("returns tokens to the app in the URL fragment only", () => {
    const location = appRedirect({ access_token: "a.b.c", refresh_token: "r+/=" }).headers.get("location")!;
    expect(location.startsWith("chorebacon://auth#")).toBe(true);
    expect(location).not.toContain("?");
    const fragment = new URLSearchParams(location.split("#")[1]);
    expect(fragment.get("access_token")).toBe("a.b.c");
    expect(fragment.get("refresh_token")).toBe("r+/=");
  });
});
