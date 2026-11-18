import "server-only";
import { InvalidHandleError } from "@pomi/shared";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type AuthService } from "../auth/auth-service";
import { signedInUser } from "../auth/signed-in-user";
import { errorResponse, requestErrorResponse, rethrow } from "../http/error-response";
import { readJsonBody } from "../http/json-request";
import {
  HandleAlreadyClaimedError,
  HandleTakenError,
  InvalidDisplayNameError,
} from "./profile-errors";
import { type ProfileService } from "./profile-service";

interface Services {
  auth: Pick<AuthService, "resolveSession">;
  profiles: Pick<ProfileService, "profile" | "claimHandle" | "setDisplayName">;
}

export async function handleGetMe(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    const profile = await services.profiles.profile(user.id);
    return NextResponse.json({ user: { email: user.email, ...profile } });
  } catch (error) {
    return requestErrorResponse(error) ?? rethrow(error);
  }
}

const claimHandleBodySchema = z.object({ handle: z.string().max(64) });

export async function handleClaimHandle(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    const body = await readJsonBody(request, claimHandleBodySchema);
    return NextResponse.json({
      profile: await services.profiles.claimHandle(user.id, body.handle),
    });
  } catch (error) {
    if (error instanceof InvalidHandleError) {
      return errorResponse(400, "invalid_handle", error.message);
    }
    if (error instanceof HandleTakenError) {
      return errorResponse(409, "handle_taken", error.message);
    }
    if (error instanceof HandleAlreadyClaimedError) {
      return errorResponse(409, "handle_claimed", error.message);
    }
    return requestErrorResponse(error) ?? rethrow(error);
  }
}

const displayNameBodySchema = z.object({ displayName: z.string().max(200) });

export async function handleSetDisplayName(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    const body = await readJsonBody(request, displayNameBodySchema);
    return NextResponse.json({
      profile: await services.profiles.setDisplayName(user.id, body.displayName),
    });
  } catch (error) {
    if (error instanceof InvalidDisplayNameError) {
      return errorResponse(400, "invalid_display_name", error.message);
    }
    return requestErrorResponse(error) ?? rethrow(error);
  }
}
