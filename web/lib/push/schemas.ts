import { z } from "zod";

// FCM registration tokens are long opaque strings (~150–200 characters today).
const token = z.string().trim().min(20).max(4096);

export const registerDeviceBody = z.object({ token, platform: z.enum(["android", "ios"]) });
export const unregisterDeviceBody = z.object({ token });
