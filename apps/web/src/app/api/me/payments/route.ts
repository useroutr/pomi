import { type NextRequest } from "next/server";
import { activityService, authService } from "@/server/app-services";
import { handleReceivedActivity } from "@/server/activity/activity-routes";

export function GET(request: NextRequest) {
  return handleReceivedActivity(request, { auth: authService(), activity: activityService() });
}
