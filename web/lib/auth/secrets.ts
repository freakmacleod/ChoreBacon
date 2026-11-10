import { createHash, randomBytes } from "node:crypto";

/** Opaque, URL-safe random token (256 bits). */
export const randomToken = () => randomBytes(32).toString("base64url");

/** Refresh tokens are only ever stored as this hash. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
