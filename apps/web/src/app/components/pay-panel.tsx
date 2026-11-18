"use client";

import { UseroutrCheckout } from "@useroutr/checkout-react";
import {
  combineWalletConnectors,
  createEip6963Connector,
  createStellarWalletsKitConnector,
  createWalletConnectEvmConnector,
} from "@useroutr/checkout-wallets";
import { type SubmitEvent, useMemo, useState } from "react";
import { z } from "zod";
import { callApi } from "@/lib/api-client";

const checkoutSchema = z.object({ token: z.string().min(1) });

export interface PayableRequest {
  id: string;
  // Null when the payer chooses the amount.
  amount: string | null;
  minimumAmount: string | null;
  assetSymbol: string;
}

// The checkout is started only when the payer asks to pay, never when the
// page loads, so a link preview or a crawler cannot create funding intents.
export function PayPanel({
  request,
  publicApiUrl,
  walletConnectProjectId,
}: {
  request: PayableRequest;
  publicApiUrl: string;
  walletConnectProjectId: string | null;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [chosenAmount, setChosenAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const payerChooses = request.amount === null;

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

  async function start(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi(`/api/r/${encodeURIComponent(request.id)}/checkout`, {
      method: "POST",
      body: payerChooses ? { amount: chosenAmount } : {},
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

  const shownAmount = payerChooses ? chosenAmount.trim() : request.amount;
  const payLabel =
    shownAmount === null || shownAmount === ""
      ? `Pay in ${request.assetSymbol}`
      : `Pay ${shownAmount} ${request.assetSymbol}`;

  if (paid) {
    return (
      <section className="card">
        <p>Payment received. Thank you.</p>
      </section>
    );
  }

  if (token === null) {
    return (
      <form className="card stack" onSubmit={(event) => void start(event)}>
        {payerChooses && (
          <div className="field">
            <label htmlFor={`amount-${request.id}`}>
              Amount in {request.assetSymbol}
              {request.minimumAmount !== null && ` (at least ${request.minimumAmount})`}
            </label>
            <input
              id={`amount-${request.id}`}
              className="text-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder={request.minimumAmount ?? "10"}
              value={chosenAmount}
              onChange={(event) => {
                setChosenAmount(event.target.value);
              }}
              required
            />
          </div>
        )}
        <button type="submit" className="pay-button" disabled={pending}>
          {pending ? "Preparing your payment..." : payLabel}
        </button>
        <p className="muted small">
          {pending
            ? "This can take up to a minute while the payment is set up on Stellar."
            : "Pay with any supported token, from a wallet or by hand."}
        </p>
        {error !== null && <p className="error">{error}</p>}
      </form>
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
