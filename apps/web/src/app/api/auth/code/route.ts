import { type NextRequest } from "next/server";
import { authService } from "@/server/app-services";
import { handleRequestSignInCode } from "@/server/auth/auth-routes";

export function POST(request: NextRequest) {
  return handleRequestSignInCode(request, authService());
}
