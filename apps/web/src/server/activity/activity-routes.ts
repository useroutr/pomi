import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { type AuthService } from "../auth/auth-service";
import { signedInUser } from "../auth/signed-in-user";
import { requestErrorResponse, rethrow } from "../http/error-response";
import { useroutrErrorResponse } from "../requests/request-routes";
import { type ActivityService } from "./activity-service";

interface Services {
  auth: Pick<AuthService, "resolveSession">;
  activity: Pick<ActivityService, "receivedActivity">;
}

export async function handleReceivedActivity(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    return NextResponse.json(await services.activity.receivedActivity(user.id));
  } catch (error) {
    return useroutrErrorResponse(error) ?? requestErrorResponse(error) ?? rethrow(error);
  }
}
