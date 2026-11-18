"use client";

import { shortenStellarAccount } from "@pomi/shared";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { callApi } from "@/lib/api-client";
import { type RequestableAsset } from "./new-request-form";

export interface DashboardPayBox {
  open: boolean;
  assetId: string;
  assetSymbol: string;
  amount: string | null;
  minimumAmount: string | null;
  payoutAddress: string;
}

export function PayBoxForm({
  payBox,
  assets,
  currentPayoutAddress,
}: {
  payBox: DashboardPayBox | null;
  assets: RequestableAsset[];
  currentPayoutAddress: string;
}) {
  const router = useRouter();
  const [assetId, setAssetId] = useState(payBox?.assetId ?? assets[0]?.id ?? "");
  const [payerChooses, setPayerChooses] = useState((payBox?.amount ?? null) === null);
  const [amount, setAmount] = useState(payBox?.amount ?? "");
  const [minimumAmount, setMinimumAmount] = useState(payBox?.minimumAmount ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi("/api/me/pay-box", {
      method: "PUT",
      body: payerChooses ? { assetId, minimumAmount } : { assetId, amount },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  async function turnOff() {
    setPending(true);
    const result = await callApi("/api/me/pay-box", { method: "DELETE" });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <form className="form" onSubmit={(event) => void save(event)}>
      {payBox !== null && (
        <p className="muted small">
          {payBox.open ? "On your page now: " : "Turned off. It was: "}
          {payBox.amount === null
            ? `any amount of ${payBox.assetSymbol}${payBox.minimumAmount === null ? "" : `, at least ${payBox.minimumAmount}`}`
            : `${payBox.amount} ${payBox.assetSymbol}`}
          , paid to {shortenStellarAccount(payBox.payoutAddress)}.
          {payBox.payoutAddress !== currentPayoutAddress &&
            " Save it again to use your new address."}
        </p>
      )}
      <div className="row">
        <label className="choice">
          <input
            type="radio"
            name="pay-box-kind"
            checked={payerChooses}
            onChange={() => {
              setPayerChooses(true);
            }}
          />
          Payer chooses the amount
        </label>
        <label className="choice">
          <input
            type="radio"
            name="pay-box-kind"
            checked={!payerChooses}
            onChange={() => {
              setPayerChooses(false);
            }}
          />
          A fixed amount
        </label>
      </div>
      <div className="row">
        <div className="field grow">
          <label htmlFor="pay-box-amount">{payerChooses ? "Minimum (optional)" : "Amount"}</label>
          <input
            id="pay-box-amount"
            inputMode="decimal"
            autoComplete="off"
            value={payerChooses ? minimumAmount : amount}
            onChange={(event) => {
              if (payerChooses) {
                setMinimumAmount(event.target.value);
              } else {
                setAmount(event.target.value);
              }
            }}
            required={!payerChooses}
          />
        </div>
        <div className="field">
          <label htmlFor="pay-box-asset">Asset</label>
          <select
            id="pay-box-asset"
            value={assetId}
            onChange={(event) => {
              setAssetId(event.target.value);
            }}
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error !== null && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={pending}>
          {payBox?.open === true ? "Save pay box" : "Turn on pay box"}
        </button>
        {payBox?.open === true && (
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={() => void turnOff()}
          >
            Turn off
          </button>
        )}
      </div>
    </form>
  );
}
