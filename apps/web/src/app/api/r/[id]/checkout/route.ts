import { checkoutService } from "@/server/app-services";
import { handleStartCheckout } from "@/server/checkout/checkout-routes";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleStartCheckout(id, checkoutService());
}
