import { type NextRequest } from "next/server";
import { authService, deviceService } from "@/server/app-services";
import { handleForgetDevice, handleRegisterDevice } from "@/server/devices/device-routes";

function services() {
  return { auth: authService(), devices: deviceService() };
}

export function POST(request: NextRequest) {
  return handleRegisterDevice(request, services());
}

export function DELETE(request: NextRequest) {
  return handleForgetDevice(request, services());
}
