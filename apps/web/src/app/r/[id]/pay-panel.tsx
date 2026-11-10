"use client";

import { UseroutrCheckout } from "@useroutr/checkout-react";
import {
  combineWalletConnectors,
  createEip6963Connector,
  createStellarWalletsKitConnector,
  createWalletConnectEvmConnector,
} from "@useroutr/checkout-wallets";
import { useMemo, useState } from "react";
import { z } from "zod";
import { callApi } from "@/lib/api-client";

const checkoutSchema = z.object({ token: z.string().min(1) });

// The checkout is started only when the payer asks to pay, never when the
// page loads, so a link preview or a crawler cannot create funding intents.
export function PayPanel({
  requestId,
  label,
  publicApiUrl,
  walletConnectProjectId,
}: {
  requestId: string;
  label: string;
  publicApiUrl: string;
  walletConnectProjectId: string | null;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // The same wallets as Useroutr's hosted checkout. The wallet libraries load
  // only when a payer opens the list.
  const wallets = useMemo(
    () =>
      combineWalletConnectors([
        createStellarWalletsKitConnector(
          walletConnectProjectId === null ? {} : { walletConnectProjectId },
        ),
        createEip6963Connector(),
        ...(walletConnectProjectId === null
          ? []
          : [createWalletConnectEvmConnector({ projectId: walletConnectProjectId })]),
      ]),
    [walletConnectProjectId],
  );

  async function start() {
    setPending(true);
    setError(null);
    const result = await callApi(`/api/r/${encodeURIComponent(requestId)}/checkout`, {
      method: "POST",
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const checkout = checkoutSchema.safeParse(result.body);
    if (!checkout.success) {
      setError("Something went wrong. Try again.");
      return;
    }
    setToken(checkout.data.token);
  }

  if (paid) {
    return (
      <section className="card">
        <p>Payment received. Thank you.</p>
      </section>
    );
  }

  if (token === null) {
    return (
      <section className="card stack">
        <button
          type="button"
          className="pay-button"
          disabled={pending}
          onClick={() => void start()}
        >
          {pending ? "Preparing your payment..." : label}
        </button>
        <p className="muted small">
          {pending
            ? "This can take up to a minute while the payment is set up on Stellar."
            : "Pay with any supported token, from a wallet or by hand."}
        </p>
        {error !== null && <p className="error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="checkout">
      <UseroutrCheckout
        token={token}
        baseUrl={publicApiUrl}
        mode="inline"
        wallets={wallets}
        onSuccess={() => {
          setPaid(true);
        }}
      />
    </section>
  );
}
