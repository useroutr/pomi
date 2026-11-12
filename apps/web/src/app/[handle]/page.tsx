import { product } from "@pomi/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PayPanel } from "@/app/components/pay-panel";
import { requestService } from "@/server/app-services";
import { serverConfig } from "@/server/config";
import { ProfileNotFoundError } from "@/server/profiles/profile-errors";
import { type HandlePage } from "@/server/requests/request-service";

interface PageProps {
  params: Promise<{ handle: string }>;
}

async function handlePage(handle: string): Promise<HandlePage> {
  try {
    return await requestService().handlePage(handle);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await handlePage((await params).handle);
  return { title: `Pay ${page.displayName ?? page.handle} | ${product.name}` };
}

export default async function ReceiverPage({ params }: PageProps) {
  const page = await handlePage((await params).handle);
  const config = serverConfig();
  return (
    <main className="pay">
      {config.stellar.network === "testnet" && (
        <p className="testnet">Testnet: this page takes test money only.</p>
      )}
      <section className="card">
        <h1 className="profile-name">{page.displayName ?? page.handle}</h1>
        <p className="muted">@{page.handle}</p>
      </section>

      {page.payBox !== null && (
        <>
          <h2 className="section-title">Pay {page.displayName ?? page.handle}</h2>
          <PayPanel
            request={page.payBox}
            publicApiUrl={config.useroutr.publicApiUrl}
            walletConnectProjectId={config.walletConnectProjectId}
          />
        </>
      )}

      {page.listedRequests.length > 0 && (
        <section className="card">
          <h2>Requests</h2>
          <ul className="requests">
            {page.listedRequests.map((request) => (
              <li key={request.id} className="request">
                <div className="request-head">
                  <strong>
                    {request.amount} {request.assetSymbol}
                  </strong>
                  <Link className="button-link" href={`/r/${request.id}`}>
                    Pay
                  </Link>
                </div>
                {request.note !== null && <p className="note">{request.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {page.payBox === null && page.listedRequests.length === 0 && (
        <section className="card">
          <p className="muted">Nothing to pay here yet.</p>
        </section>
      )}
      <p className="muted small center">
        {product.name} never holds your money. Payments are processed by Useroutr.
      </p>
    </main>
  );
}
