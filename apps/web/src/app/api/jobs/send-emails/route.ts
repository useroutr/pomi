import { type NextRequest } from "next/server";
import { outboxSender } from "@/server/app-services";
import { serverConfig } from "@/server/config";
import { handleSendEmailsJob } from "@/server/notifications/job-routes";

export function GET(request: NextRequest) {
  return handleSendEmailsJob(request, serverConfig().cronSecret, outboxSender());
}
