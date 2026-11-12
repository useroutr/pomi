import { product } from "@pomi/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayPanel } from "@/app/components/pay-panel";
import { closedReason, RequestSummary } from "@/app/components/request-summary";
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
  const closed = closedReason(request);
  return (
    <main className="pay">
      {config.stellar.network === "testnet" && (
        <p className="testnet">Testnet: this request takes test money only.</p>
      )}
      <RequestSummary request={request} />
      {closed === null ? (
        <PayPanel
          request={request}
          publicApiUrl={config.useroutr.publicApiUrl}
          walletConnectProjectId={config.walletConnectProjectId}
        />
      ) : (
        <section className="card">
          <p>{closed}</p>
        </section>
      )}
      <p className="muted small center">
        {product.name} never holds your money. Payments are processed by Useroutr.
      </p>
    </main>
  );
}
