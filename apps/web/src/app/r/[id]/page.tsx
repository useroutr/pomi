import { product } from "@pomi/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { PayPanel } from "@/app/components/pay-panel";
import pay from "@/app/components/pay.module.css";
import {
  AmountShown,
  AssetLine,
  ClosedState,
  closedReason,
  ReceiverLine,
  RequestDetails,
  TrustLine,
} from "@/app/components/request-summary";
import ui from "@/app/components/ui.module.css";
import { requestService } from "@/server/app-services";
import { serverConfig } from "@/server/config";

interface PageProps {
  params: Promise<{ id: string }>;
}

// A request link is shared privately; it should never be listed by a search
// engine.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const request = await requestService().payerRequest((await params).id);
  const title =
    request === null
      ? product.name
      : `Pay ${request.amount ?? "any amount of"} ${request.assetSymbol}`;
  return { title: `${title} | ${product.name}`, robots: { index: false, follow: false } };
}

export default async function PayPage({ params }: PageProps) {
  const request = await requestService().payerRequest((await params).id);
  if (request === null) {
    notFound();
  }
  const config = serverConfig();
  const receiver = request.receiverName ?? request.receiverHandle ?? "Someone";
  const label = request.amount === null ? `Pay ${receiver}` : `${receiver} asks for`;
  return (
    <>
      <div className={ui.backdrop} aria-hidden="true" />
      <AppHeader>
        <Link href="/sign-in" className={[ui.secondaryButton, ui.compact].join(" ")}>
          Get your own link
        </Link>
      </AppHeader>
      <main className={pay.column}>
        {config.stellar.network === "testnet" && (
          <p className={ui.notice}>Testnet: this request takes test money only.</p>
        )}
        <section className={pay.card} aria-label={`Pay ${receiver}`}>
          <ReceiverLine name={receiver} handle={request.receiverHandle} />
          {closedReason(request) === null ? (
            <PayPanel
              request={request}
              label={label}
              publicApiUrl={config.useroutr.publicApiUrl}
              walletConnectProjectId={config.walletConnectProjectId}
            >
              <RequestDetails request={request} />
            </PayPanel>
          ) : (
            <div className={pay.panel}>
              {request.amount !== null && (
                <AmountShown
                  label={label}
                  amount={request.amount}
                  assetSymbol={request.assetSymbol}
                />
              )}
              <AssetLine
                assetSymbol={request.assetSymbol}
                assetNetwork={request.assetNetwork}
                payable={false}
              />
              <ClosedState request={request} />
            </div>
          )}
        </section>
        <TrustLine />
      </main>
    </>
  );
}
