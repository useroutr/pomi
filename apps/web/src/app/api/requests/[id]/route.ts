import { type NextRequest } from "next/server";
import { authService, requestService } from "@/server/app-services";
import { serverConfig } from "@/server/config";
import { handleUpdateRequest } from "@/server/requests/request-routes";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleUpdateRequest(request, id, {
    auth: authService(),
    requests: requestService(),
    appUrl: serverConfig().appUrl,
  });
}
