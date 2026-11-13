import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ANDROID_CHANNEL, classifyResponse, fcmMessage, serviceAccount, signedAssertion } from "./fcm";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = {
  project_id: "chorebacon-test",
  client_email: "push@chorebacon-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

describe("FCM service account", () => {
  it("is off without configuration and rejects a key that is not a service account", () => {
    expect(serviceAccount(undefined)).toBeNull();
    expect(serviceAccount(JSON.stringify(account))).toEqual(account);
    expect(() => serviceAccount(JSON.stringify({ project_id: "x" }))).toThrow(/service account/);
  });

  it("signs an RS256 assertion for the FCM scope, valid for one hour", () => {
    const now = new Date("2026-11-13T15:00:00Z");
    const [header, claims, signature] = signedAssertion(account, now).split(".");
    const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());
    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decode(claims)).toEqual({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now.getTime() / 1000,
      exp: now.getTime() / 1000 + 3600,
    });
    expect(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, signature, "base64url")).toBe(true);
  });
});

describe("FCM messages", () => {
  it("targets one device on the app's notification channel", () => {
    expect(fcmMessage("tok", { title: "Hej", body: "Ny syssla", data: { kind: "temporary_chore" } })).toEqual({
      message: {
        token: "tok",
        notification: { title: "Hej", body: "Ny syssla" },
        data: { kind: "temporary_chore" },
        android: { priority: "high", notification: { channel_id: ANDROID_CHANNEL } },
      },
    });
  });

  it("tells dead tokens apart from other failures", async () => {
    const answer = (status: number, body?: object) => new Response(body ? JSON.stringify(body) : null, { status });
    expect(await classifyResponse(answer(200, { name: "projects/x/messages/1" }))).toBe("sent");
    expect(await classifyResponse(answer(404, { error: { status: "NOT_FOUND" } }))).toBe("invalid_token");
    expect(await classifyResponse(answer(400, { error: { status: "INVALID_ARGUMENT", message: "The registration token is not a valid FCM registration token" } }))).toBe(
      "invalid_token",
    );
    expect(await classifyResponse(answer(400, { error: { status: "INVALID_ARGUMENT", message: "Invalid JSON payload" } }))).toBe("failed");
    expect(await classifyResponse(answer(503))).toBe("failed");
  });
});
