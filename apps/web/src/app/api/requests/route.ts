import { type NextRequest } from "next/server";
import { authService, requestService } from "@/server/app-services";
import { serverConfig } from "@/server/config";
import { handleCreateRequest, handleListRequests } from "@/server/requests/request-routes";

function services() {
  return { auth: authService(), requests: requestService(), appUrl: serverConfig().appUrl };
}

export function POST(request: NextRequest) {
  return handleCreateRequest(request, services());
}

export function GET(request: NextRequest) {
  return handleListRequests(request, services());
}
