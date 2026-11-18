import { type NextRequest } from "next/server";
import { authService, requestService } from "@/server/app-services";
import { serverConfig } from "@/server/config";
import {
  handleClosePayBox,
  handleGetPayBox,
  handleSetPayBox,
} from "@/server/requests/request-routes";

function services() {
  return { auth: authService(), requests: requestService(), appUrl: serverConfig().appUrl };
}

export function GET(request: NextRequest) {
  return handleGetPayBox(request, services());
}

export function PUT(request: NextRequest) {
  return handleSetPayBox(request, services());
}

export function DELETE(request: NextRequest) {
  return handleClosePayBox(request, services());
}
