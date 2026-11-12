import { type NextRequest } from "next/server";
import { authService, profileService } from "@/server/app-services";
import { handleSetDisplayName } from "@/server/profiles/profile-routes";

export function PUT(request: NextRequest) {
  return handleSetDisplayName(request, { auth: authService(), profiles: profileService() });
}
