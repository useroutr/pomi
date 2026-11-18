import { formatAmount, product } from "@pomi/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { Avatar } from "@/app/components/avatar";
import { ArrowIcon } from "@/app/components/icons";
import { PayPanel } from "@/app/components/pay-panel";
import pay from "@/app/components/pay.module.css";
import { RequestDetails, TrustLine } from "@/app/components/request-summary";
import { TokenMark } from "@/app/components/token-mark";
import ui from "@/app/components/ui.module.css";
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
  const name = page.displayName ?? page.handle;
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
          <p className={ui.notice}>Testnet: this page takes test money only.</p>
        )}
        <header className={pay.profile}>
          <Avatar name={name} size={88} />
          <h1>{name}</h1>
          <p>@{page.handle}</p>
        </header>

        {page.payBox !== null && (
          <section className={pay.card} aria-label={`Pay ${name}`}>
            <PayPanel
              request={page.payBox}
              label={page.payBox.amount === null ? `Pay ${name}` : `${name} asks for`}
              publicApiUrl={config.useroutr.publicApiUrl}
              walletConnectProjectId={config.walletConnectProjectId}
            >
              <RequestDetails request={page.payBox} />
            </PayPanel>
          </section>
        )}

        {page.listedRequests.length > 0 && (
          <section aria-labelledby="requests-title">
            <h2 id="requests-title" className={pay.sectionTitle}>
              Requests
            </h2>
            <ul className={pay.rows}>
              {page.listedRequests.map((request) => (
                <li key={request.id}>
                  <Link className={pay.row} href={`/r/${request.id}`}>
                    <TokenMark
                      symbol={request.assetSymbol}
                      network={request.assetNetwork}
                      size={40}
                    />
                    <span className={pay.rowText}>
                      <strong>
                        {request.amount === null
                          ? `Any amount of ${request.assetSymbol}`
                          : `${formatAmount(request.amount)} ${request.assetSymbol}`}
                      </strong>
                      {request.note !== null && <span>{request.note}</span>}
                    </span>
                    <span className={pay.rowPay}>
                      Pay
                      <ArrowIcon />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {page.payBox === null && page.listedRequests.length === 0 && (
          <section className={pay.card}>
            <div className={pay.state}>
              <strong>Nothing to pay yet</strong>
              <p>{name} has no open requests on this page right now.</p>
            </div>
          </section>
        )}
        <TrustLine />
      </main>
    </>
  );
}
