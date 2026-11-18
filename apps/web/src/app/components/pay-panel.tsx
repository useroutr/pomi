"use client";

import { formatAmount } from "@pomi/shared";
import { UseroutrCheckout } from "@useroutr/checkout-react";
import {
  combineWalletConnectors,
  createEip6963Connector,
  createStellarWalletsKitConnector,
  createWalletConnectEvmConnector,
} from "@useroutr/checkout-wallets";
import { type ReactNode, type SubmitEvent, useMemo, useState } from "react";
import { z } from "zod";
import { callApi } from "@/lib/api-client";
import { CheckIcon } from "./icons";
import pay from "./pay.module.css";
import { AmountShown, AssetLine } from "./request-summary";
import ui from "./ui.module.css";

const checkoutSchema = z.object({ token: z.string().min(1) });

// What can be typed as an amount while it is being typed; the server checks
// the finished amount.
const AMOUNT_TYPING = /^\d{0,12}(\.\d{0,7})?$/;

export interface PayableRequest {
  id: string;
  // Null when the payer chooses the amount.
  amount: string | null;
  minimumAmount: string | null;
  assetSymbol: string;
  assetNetwork: string;
}

// The checkout is started only when the payer asks to pay, never when the
// page loads, so a link preview or a crawler cannot create funding intents.
export function PayPanel({
  request,
  label,
  publicApiUrl,
  walletConnectProjectId,
  children,
}: {
  request: PayableRequest;
  // Above the amount: who asks, or whom the payer pays.
  label: string;
  publicApiUrl: string;
  walletConnectProjectId: string | null;
  // What the payer reads between the amount and the button.
  children?: ReactNode;
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

  const shownAmount = payerChooses ? chosenAmount.trim() : (request.amount ?? "");
  const payLabel =
    shownAmount === "" || shownAmount === "."
      ? `Pay in ${request.assetSymbol}`
      : `Pay ${formatAmount(shownAmount)} ${request.assetSymbol}`;

  if (paid) {
    return (
      <div className={pay.state} role="status">
        <span className={pay.stateIconDone}>
          <CheckIcon />
        </span>
        <strong>Payment received</strong>
        <p>
          {formatAmount(shownAmount)} {request.assetSymbol}. Thank you.
        </p>
      </div>
    );
  }

  const amountPlaceholder = request.minimumAmount ?? "0";

  // The same summary before and after the checkout opens; the checkout sits
  // outside the form so none of its buttons can submit it again.
  const summary = (
    <>
      {payerChooses ? (
        <div className={pay.amountBox}>
          <label className={pay.amountLabel} htmlFor={`amount-${request.id}`}>
            {label}
          </label>
          <div className={pay.amountEntry}>
            <input
              id={`amount-${request.id}`}
              className={pay.amountInput}
              style={{
                width: `${String(Math.max(chosenAmount.length, amountPlaceholder.length, 1) + 0.3)}ch`,
              }}
              inputMode="decimal"
              autoComplete="off"
              placeholder={amountPlaceholder}
              value={chosenAmount}
              readOnly={token !== null}
              onChange={(event) => {
                const typed = event.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                if (AMOUNT_TYPING.test(typed)) {
                  setChosenAmount(typed);
                }
              }}
              required
            />
            <span className={pay.amountSymbol}>{request.assetSymbol}</span>
          </div>
          <p className={ui.hint}>
            {request.minimumAmount === null
              ? "You choose the amount"
              : `At least ${formatAmount(request.minimumAmount)} ${request.assetSymbol}`}
          </p>
        </div>
      ) : (
        <AmountShown label={label} amount={shownAmount} assetSymbol={request.assetSymbol} />
      )}
      <AssetLine assetSymbol={request.assetSymbol} assetNetwork={request.assetNetwork} />
      {children}
    </>
  );

  if (token !== null) {
    return (
      <div className={pay.panel}>
        {summary}
        <div className={pay.checkout}>
          <UseroutrCheckout
            token={token}
            baseUrl={publicApiUrl}
            mode="inline"
            wallets={wallets}
            onSuccess={() => {
              setPaid(true);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <form className={pay.panel} onSubmit={(event) => void start(event)}>
      {summary}
      <div className={pay.action}>
        {error !== null && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={[ui.primaryButton, ui.wide].join(" ")} disabled={pending}>
          {pending ? "Preparing your payment..." : payLabel}
        </button>
        <p className={ui.hint}>
          {pending
            ? "This can take up to a minute while the payment is set up on Stellar."
            : "Pay with any supported token, from a wallet or by hand."}
        </p>
      </div>
    </form>
  );
}
