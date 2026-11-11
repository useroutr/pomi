import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type AuthService } from "../auth/auth-service";
import { signedInUser } from "../auth/signed-in-user";
import { errorResponse, requestErrorResponse, rethrow } from "../http/error-response";
import { readJsonBody } from "../http/json-request";
import { type DeviceService, InvalidPushTokenError } from "./device-service";

interface Services {
  auth: Pick<AuthService, "resolveSession">;
  devices: Pick<DeviceService, "registerDevice" | "forgetDevice">;
}

const registerBodySchema = z.object({
  pushToken: z.string().max(200),
  platform: z.enum(["IOS", "ANDROID"]),
});

const forgetBodySchema = z.object({ pushToken: z.string().max(200) });

export async function handleRegisterDevice(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    const body = await readJsonBody(request, registerBodySchema);
    await services.devices.registerDevice(user.id, body);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof InvalidPushTokenError) {
      return errorResponse(400, "invalid_push_token", error.message);
    }
    return requestErrorResponse(error) ?? rethrow(error);
  }
}

export async function handleForgetDevice(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    const body = await readJsonBody(request, forgetBodySchema);
    await services.devices.forgetDevice(user.id, body.pushToken);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return requestErrorResponse(error) ?? rethrow(error);
  }
}
