import { checkoutService } from "@/server/app-services";
import { handleStartCheckout } from "@/server/checkout/checkout-routes";

// Useroutr opens a deposit account and registers the intent on Stellar
// before it answers, which took over 30 seconds on testnet, and a visitor
// arriving meanwhile waits for that same answer.
export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleStartCheckout(id, checkoutService());
}
