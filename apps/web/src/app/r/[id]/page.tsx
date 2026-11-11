import { product, shortenStellarAccount } from "@pomi/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requestService } from "@/server/app-services";
import { serverConfig } from "@/server/config";
import { PayPanel } from "./pay-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

// A request link is shared privately; it should never be listed by a search
// engine.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const request = await requestService().payerRequest((await params).id);
  const title =
    request?.amount == null ? product.name : `Pay ${request.amount} ${request.assetSymbol}`;
  return { title: `${title} | ${product.name}`, robots: { index: false, follow: false } };
}

export default async function PayPage({ params }: PageProps) {
  const request = await requestService().payerRequest((await params).id);
  if (request?.amount == null) {
    notFound();
  }
  const config = serverConfig();
  return (
    <main className="pay">
      {config.stellar.network === "testnet" && (
        <p className="testnet">Testnet: this request takes test money only.</p>
      )}
      <section className="card">
        <p className="muted">{request.receiverName ?? "Someone"} asks for</p>
        <p className="pay-amount">
          {request.amount} <span>{request.assetSymbol}</span>
        </p>
        {/* Plain text, never linked: a note is the receiver's words, and a
            link in it could pass for Pomi's own. */}
        {request.note !== null && <p className="note">{request.note}</p>}
        <p className="muted small">
          Paid on Stellar to {shortenStellarAccount(request.payoutAddress)}
          {request.payoutAddressVerified
            ? ", a verified address"
            : ", an address the receiver pasted"}
        </p>
      </section>

      {request.status === "PAID" && (
        <section className="card">
          <p>This request has been paid.</p>
        </section>
      )}
      {request.status === "CLOSED" && (
        <section className="card">
          <p>The receiver closed this request.</p>
        </section>
      )}
      {request.status === "OPEN" && (
        <PayPanel
          requestId={request.id}
          label={`Pay ${request.amount} ${request.assetSymbol}`}
          publicApiUrl={config.useroutr.publicApiUrl}
          walletConnectProjectId={config.walletConnectProjectId}
        />
      )}
      <p className="muted small center">
        {product.name} never holds your money. Payments are processed by Useroutr.
      </p>
    </main>
  );
}
