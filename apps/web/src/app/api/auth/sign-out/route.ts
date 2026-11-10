import { type NextRequest } from "next/server";
import { authService } from "@/server/app-services";
import { handleSignOut } from "@/server/auth/auth-routes";

export function POST(request: NextRequest) {
  return handleSignOut(request, authService());
}
