import { product } from "@pomi/shared";
import { UseroutrError } from "@useroutr/sdk";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import ui from "@/app/components/ui.module.css";
import {
  activityService,
  payoutAddressService,
  profileService,
  requestService,
} from "@/server/app-services";
import { currentUser } from "@/server/auth/current-user";
import { serverConfig } from "@/server/config";
import styles from "./dashboard.module.css";
import { NewRequestForm } from "./new-request-form";
import { PageCard } from "./page-card";
import { PayBoxForm } from "./pay-box-form";
import { PaymentLog } from "./payment-log";
import { PayoutAddresses } from "./payout-addresses";
import { DisplayNameForm } from "./profile-form";
import { ReceivedOverview } from "./received-overview";
import { RequestList } from "./request-list";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: `Dashboard | ${product.name}`,
};

const UNAVAILABLE = "Payments are unavailable right now. Try again in a moment.";

export default async function DashboardPage() {
  const user = await currentUser();
  if (user === null) {
    redirect("/sign-in");
  }
  const config = serverConfig();
  const [saved, profile, catalog] = await Promise.all([
    payoutAddressService().payoutAddresses(user.id),
    profileService().profile(user.id),
    useroutrCatalog(user.id),
  ]);
  const addresses = saved.map(({ network, address }) => ({ network, address }));
  const payoutNetworks = networksPaidOutOn(catalog?.assets ?? [], addresses);
  const where = <PayoutAddresses networks={payoutNetworks} saved={addresses} />;

  return (
    <>
      <AppHeader>
        <span className={styles.email}>{user.email}</span>
        <SignOutButton />
      </AppHeader>
      <main className={styles.main}>
        {config.stellar.network === "testnet" && (
          <p className={ui.notice}>Testnet: payments here use test money on the Stellar testnet.</p>
        )}

        <div className={styles.top}>
          <PageCard
            handle={profile.handle}
            displayName={profile.displayName}
            email={user.email}
            appUrl={config.appUrl}
          />
          {catalog === null ? (
            <section className={[ui.card, styles.summary].join(" ")}>
              <span className={styles.summaryLabel}>Received</span>
              <p className={styles.unavailable}>
                Your totals cannot be shown while Useroutr is unreachable.
              </p>
            </section>
          ) : (
            <ReceivedOverview activity={catalog.activity} />
          )}
        </div>

        <div className={styles.columns}>
          {/* A receiver without an address can ask for nothing, so where to be
              paid takes the place of the request form until there is one. */}
          {addresses.length === 0 ? (
            <section className={[ui.card, styles.create].join(" ")} aria-labelledby="payout-title">
              <div>
                <h2 id="payout-title" className={ui.cardTitle}>
                  Where you get paid
                </h2>
                <p className={ui.hint}>
                  Add the address of a wallet you own on any of these networks; then you can ask for
                  money there.
                </p>
              </div>
              {where}
            </section>
          ) : (
            <section className={[ui.card, styles.create].join(" ")} aria-labelledby="new-title">
              <h2 id="new-title" className={ui.cardTitle}>
                New request
              </h2>
              {catalog === null ? (
                <p className={styles.unavailable}>{UNAVAILABLE}</p>
              ) : (
                <NewRequestForm
                  assets={catalog.assets}
                  addressNetworks={addresses.map((saved) => saved.network)}
                />
              )}
            </section>
          )}

          <div className={styles.list}>
            <section className={ui.card} aria-labelledby="payments-title">
              <div className={styles.sectionHead}>
                <h2 id="payments-title" className={ui.cardTitle}>
                  Payments
                </h2>
              </div>
              {catalog === null ? (
                <p className={styles.unavailable}>
                  Your payments cannot be shown while Useroutr is unreachable.
                </p>
              ) : (
                <PaymentLog
                  payments={catalog.activity.recent}
                  paymentsInAll={catalog.activity.totals.reduce(
                    (sum, total) => sum + total.payments,
                    0,
                  )}
                  network={config.stellar.network}
                />
              )}
            </section>

            <section className={ui.card} aria-labelledby="requests-title">
              <div className={styles.sectionHead}>
                <h2 id="requests-title" className={ui.cardTitle}>
                  Your requests
                </h2>
                {catalog !== null && catalog.requests.length > 0 && (
                  <span className={ui.chip}>{catalog.requests.length}</span>
                )}
              </div>
              {catalog === null ? (
                <p className={styles.unavailable}>
                  Your requests cannot be shown while Useroutr is unreachable.
                </p>
              ) : (
                <RequestList
                  requests={catalog.requests}
                  appUrl={config.appUrl}
                  network={config.stellar.network}
                />
              )}
            </section>
          </div>

          <div className={styles.settings}>
            <section className={ui.card} aria-labelledby="pay-box-title">
              <div>
                <h2 id="pay-box-title" className={ui.cardTitle}>
                  Pay box
                </h2>
                <p className={ui.hint}>
                  On your page, anyone can pay you in one step, as often as they like.
                </p>
              </div>
              {catalog === null ? (
                <p className={styles.unavailable}>{UNAVAILABLE}</p>
              ) : addresses.length === 0 ? (
                <p className={styles.unavailable}>Add the address you want to be paid at first.</p>
              ) : (
                <PayBoxForm payBox={catalog.payBox} assets={catalog.assets} addresses={addresses} />
              )}
            </section>

            {addresses.length > 0 && (
              <section className={ui.card} aria-labelledby="payout-title">
                <div>
                  <h2 id="payout-title" className={ui.cardTitle}>
                    Where you get paid
                  </h2>
                  <p className={ui.hint}>
                    One address per network. Requests on a network pay its address.
                  </p>
                </div>
                {where}
              </section>
            )}

            <section className={ui.card} aria-labelledby="name-title">
              <h2 id="name-title" className={ui.cardTitle}>
                Name shown to payers
              </h2>
              <DisplayNameForm displayName={profile.displayName} />
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

// Every network a request can be paid on, Stellar first, then as Useroutr
// lists them; a network with a saved address that Useroutr no longer pays out
// on stays, so its address can still be seen.
function networksPaidOutOn(assets: { network: string }[], saved: { network: string }[]): string[] {
  const networks = new Set(["stellar", ...assets.map((asset) => asset.network)]);
  for (const address of saved) {
    networks.add(address.network);
  }
  return [...networks];
}

// Asset symbols come from Useroutr, so both lists need it. When it cannot be
// reached the dashboard still loads, and says so where it matters.
async function useroutrCatalog(userId: string) {
  try {
    const [assets, requests, payBox, activity] = await Promise.all([
      requestService().requestableAssets(),
      requestService().listRequests(userId),
      requestService().payBox(userId),
      activityService().receivedActivity(userId),
    ]);
    return {
      assets: assets.map(({ id, symbol, network }) => ({ id, symbol, network })),
      requests,
      payBox,
      activity,
    };
  } catch (error) {
    if (error instanceof UseroutrError) {
      return null;
    }
    throw error;
  }
}
