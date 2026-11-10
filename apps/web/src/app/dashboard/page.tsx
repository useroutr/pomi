import { product } from "@pomi/shared";
import { UseroutrError } from "@useroutr/sdk";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { payoutAddressService, requestService } from "@/server/app-services";
import { currentUser } from "@/server/auth/current-user";
import { serverConfig } from "@/server/config";
import { NewRequestForm } from "./new-request-form";
import { PayoutAddressForm } from "./payout-address-form";
import { RequestList } from "./request-list";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: `Dashboard | ${product.name}`,
};

export default async function DashboardPage() {
  const user = await currentUser();
  if (user === null) {
    redirect("/sign-in");
  }
  const config = serverConfig();
  const [payoutAddress, catalog] = await Promise.all([
    payoutAddressService().payoutAddress(user.id),
    useroutrCatalog(user.id),
  ]);

  return (
    <main className="dashboard">
      <header className="dashboard-head">
        <h1>{product.name}</h1>
        <div className="row">
          <span className="muted small">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      {config.stellar.network === "testnet" && (
        <p className="testnet">Testnet: payments here use test money on the Stellar testnet.</p>
      )}

      <section className="card">
        <h2>Where you get paid</h2>
        <PayoutAddressForm current={payoutAddress?.address ?? null} />
      </section>

      <section className="card">
        <h2>New request</h2>
        {catalog === null ? (
          <p className="error">Payments are unavailable right now. Try again in a moment.</p>
        ) : payoutAddress === null ? (
          <p className="muted">Add the address you want to be paid at first.</p>
        ) : (
          <NewRequestForm assets={catalog.assets} />
        )}
      </section>

      <section className="card">
        <h2>Your requests</h2>
        {catalog === null ? (
          <p className="error">Your requests cannot be shown while Useroutr is unreachable.</p>
        ) : (
          <RequestList
            requests={catalog.requests}
            appUrl={config.appUrl}
            network={config.stellar.network}
          />
        )}
      </section>
    </main>
  );
}

// Asset symbols come from Useroutr, so both lists need it. When it cannot be
// reached the dashboard still loads, and says so where it matters.
async function useroutrCatalog(userId: string) {
  try {
    const [assets, requests] = await Promise.all([
      requestService().requestableAssets(),
      requestService().listRequests(userId),
    ]);
    return { assets: assets.map(({ id, symbol }) => ({ id, symbol })), requests };
  } catch (error) {
    if (error instanceof UseroutrError) {
      return null;
    }
    throw error;
  }
}
