import { db } from "@/db";
import { noContent, requireUser } from "@/lib/api";
import { parseJson } from "@/lib/http";
import { registerDeviceBody, unregisterDeviceBody } from "@/lib/push/schemas";
import { registerDevice, unregisterDevice } from "@/lib/push/service";

/** Registers this device's push token for the signed-in user (called at sign-in and whenever FCM rotates it). */
export async function PUT(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const body = await parseJson(request, registerDeviceBody);
  if (!body.ok) return body.response;
  await registerDevice(db, auth.userId, body.data.token, body.data.platform, new Date());
  return noContent();
}

/** Stops push to this device (called before signing out). */
export async function DELETE(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const body = await parseJson(request, unregisterDeviceBody);
  if (!body.ok) return body.response;
  await unregisterDevice(db, auth.userId, body.data.token);
  return noContent();
}
