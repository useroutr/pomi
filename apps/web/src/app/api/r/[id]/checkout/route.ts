import { type NextRequest } from "next/server";
import { checkoutService } from "@/server/app-services";
import { handleStartCheckout } from "@/server/checkout/checkout-routes";
import { serverConfig } from "@/server/config";

// Useroutr opens a deposit account and registers the intent on Stellar
// before it answers, which took over 30 seconds on testnet, and a visitor
// arriving meanwhile waits for that same answer.
export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = serverConfig();
  return handleStartCheckout(request, id, {
    checkout: checkoutService(),
    clientIpHeader: config.clientIpHeader,
    clientKeySecret: config.authSecret,
  });
}
