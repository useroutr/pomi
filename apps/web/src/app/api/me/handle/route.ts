import { type NextRequest } from "next/server";
import { authService, profileService } from "@/server/app-services";
import { handleClaimHandle } from "@/server/profiles/profile-routes";

export function POST(request: NextRequest) {
  return handleClaimHandle(request, { auth: authService(), profiles: profileService() });
}
