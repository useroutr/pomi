import { type NextRequest } from "next/server";
import { authService, profileService } from "@/server/app-services";
import { handleGetHandleAvailability } from "@/server/profiles/profile-routes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  return handleGetHandleAvailability(request, handle, {
    auth: authService(),
    profiles: profileService(),
  });
}
