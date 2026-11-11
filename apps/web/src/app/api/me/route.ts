import { type NextRequest } from "next/server";
import { authService, profileService } from "@/server/app-services";
import { handleGetMe } from "@/server/profiles/profile-routes";

export function GET(request: NextRequest) {
  return handleGetMe(request, { auth: authService(), profiles: profileService() });
}
