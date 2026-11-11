import { type NextRequest } from "next/server";
import { authService, payoutAddressService } from "@/server/app-services";
import {
  handleGetPayoutAddress,
  handleSetPayoutAddress,
} from "@/server/payout-addresses/payout-address-routes";

function services() {
  return { auth: authService(), payoutAddresses: payoutAddressService() };
}

export function GET(request: NextRequest) {
  return handleGetPayoutAddress(request, services());
}

export function PUT(request: NextRequest) {
  return handleSetPayoutAddress(request, services());
}
