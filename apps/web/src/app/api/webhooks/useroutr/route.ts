import { after, type NextRequest } from "next/server";
import { outboxSender, webhookService } from "@/server/app-services";
import { handleUseroutrWebhook } from "@/server/webhooks/webhook-routes";

export function POST(request: NextRequest) {
  return handleUseroutrWebhook(request, webhookService(), () => {
    // After the response, so Useroutr is never kept waiting on email. A
    // failure is logged by Next, and the scheduled job sends it later.
    after(() => outboxSender().sendPending());
  });
}
