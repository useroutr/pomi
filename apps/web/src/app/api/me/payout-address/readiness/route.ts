import { type NextRequest } from "next/server";
import { authService, payoutAddressService, requestService } from "@/server/app-services";
import { handleGetPayoutReadiness } from "@/server/payout-addresses/payout-address-routes";

export function GET(request: NextRequest) {
  return handleGetPayoutReadiness(request, {
    auth: authService(),
    payoutAddresses: payoutAddressService(),
    requests: requestService(),
  });
}
