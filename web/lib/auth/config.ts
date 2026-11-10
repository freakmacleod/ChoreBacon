export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60;

/** Callback scheme registered by the MAUI app (Android intent filter, iOS CFBundleURLTypes). */
export const APP_CALLBACK_URL = "chorebacon://auth";

export function jwtSigningKey(): string {
  const key = process.env.JWT_SIGNING_KEY;
  if (!key || key.length < 32) throw new Error("JWT_SIGNING_KEY is missing or shorter than 32 characters");
  return key;
}

/**
 * Dev login is available only when explicitly enabled, and never on a production deployment —
 * even if ALLOW_DEV_LOGIN were set there by mistake.
 */
export function isDevLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ALLOW_DEV_LOGIN === "true" && env.VERCEL_ENV !== "production";
}

/**
 * Public origin used in OAuth redirect URIs. Must match the URIs registered with Google/Facebook,
 * so production always uses the stable production domain rather than whatever alias was hit.
 */
export function publicOrigin(request: Request, env: NodeJS.ProcessEnv = process.env): string {
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return new URL(request.url).origin;
}
