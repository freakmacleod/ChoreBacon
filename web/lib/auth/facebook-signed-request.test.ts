import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignedRequest } from "./facebook-signed-request";

const SECRET = "app-secret";
const sign = (payload: object, secret = SECRET) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${createHmac("sha256", secret).update(body).digest("base64url")}.${body}`;
};

describe("Facebook signed_request", () => {
  it("returns the app-scoped user id when the signature matches", () => {
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "1234", issued_at: 1 }), SECRET)).toMatchObject({ user_id: "1234" });
  });

  it("rejects a wrong secret, a tampered payload, other algorithms and garbage", () => {
    const good = sign({ algorithm: "HMAC-SHA256", user_id: "1234" });
    const [sig] = good.split(".");
    const tampered = `${sig}.${Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "999" })).toString("base64url")}`;
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "1234" }, "other"), SECRET)).toBeNull();
    expect(parseSignedRequest(tampered, SECRET)).toBeNull();
    expect(parseSignedRequest(sign({ algorithm: "none", user_id: "1234" }), SECRET)).toBeNull();
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256" }), SECRET)).toBeNull();
    expect(parseSignedRequest("nonsense", SECRET)).toBeNull();
    expect(parseSignedRequest(`${good}.x`, SECRET)).toBeNull();
  });
});
