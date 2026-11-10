import { jwtSigningKey } from "./config";
import { type AccessClaims, verifyAccessToken } from "./jwt";

/** Claims of a valid `Authorization: Bearer <access token>` header, or null. */
export function authenticate(request: Request, now = new Date()): AccessClaims | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer (.+)$/);
  return match ? verifyAccessToken(match[1], jwtSigningKey(), now) : null;
}
