import { type NextRequest } from "next/server";
import { authService } from "@/server/app-services";
import { handleVerifySignInCode } from "@/server/auth/auth-routes";

export function POST(request: NextRequest) {
  return handleVerifySignInCode(request, authService());
}
