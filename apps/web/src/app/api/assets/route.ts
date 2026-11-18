import { type NextRequest } from "next/server";
import { authService, requestService } from "@/server/app-services";
import { serverConfig } from "@/server/config";
import { handleListAssets } from "@/server/requests/request-routes";

export function GET(request: NextRequest) {
  return handleListAssets(request, {
    auth: authService(),
    requests: requestService(),
    appUrl: serverConfig().appUrl,
  });
}
