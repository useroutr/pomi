"use client";

import { formatAmount, networkName, shortenAddress } from "@pomi/shared";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import ui from "@/app/components/ui.module.css";
import { callApi } from "@/lib/api-client";
import { AssetSelect, type RequestableAsset } from "./asset-select";
import styles from "./dashboard.module.css";

export interface DashboardPayBox {
  open: boolean;
  assetId: string;
  assetSymbol: string;
  assetNetwork: string;
  amount: string | null;
  minimumAmount: string | null;
  payoutAddress: string;
}

function describe(payBox: DashboardPayBox): string {
  const asked =
    payBox.amount === null
      ? `Any amount of ${payBox.assetSymbol}${payBox.minimumAmount === null ? "" : `, at least ${formatAmount(payBox.minimumAmount)}`}`
      : `${formatAmount(payBox.amount)} ${payBox.assetSymbol}`;
  return `${asked}, paid to ${shortenAddress(payBox.assetNetwork, payBox.payoutAddress)}.`;
}

export function PayBoxForm({
  payBox,
  assets,
  addresses,
}: {
  payBox: DashboardPayBox | null;
  assets: RequestableAsset[];
  // The receiver's address on each network: the pay box pays the one on its
  // asset's network.
  addresses: { network: string; address: string }[];
}) {
  const router = useRouter();
  // A new pay box starts on an asset the receiver can already be paid in.
  const [assetId, setAssetId] = useState(
    payBox?.assetId ??
      (
        assets.find((asset) => addresses.some((saved) => saved.network === asset.network)) ??
        assets[0]
      )?.id ??
      "",
  );
  const [payerChooses, setPayerChooses] = useState((payBox?.amount ?? null) === null);
  const [amount, setAmount] = useState(payBox?.amount ?? "");
  const [minimumAmount, setMinimumAmount] = useState(payBox?.minimumAmount ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addressOn = (network: string) =>
    addresses.find((saved) => saved.network === network)?.address;
  const network = assets.find((asset) => asset.id === assetId)?.network;
  const needsAddress = network !== undefined && addressOn(network) === undefined;

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
    <form className={styles.form} onSubmit={(event) => void save(event)}>
      {payBox !== null && (
        <p className={styles.status}>
          <span className={payBox.open ? ui.chipPaid : ui.chip}>
            {payBox.open ? "On your page" : "Off"}
          </span>
          {describe(payBox)}
          {addressOn(payBox.assetNetwork) !== undefined &&
            payBox.payoutAddress !== addressOn(payBox.assetNetwork) &&
            " Save it again to use your new address."}
        </p>
      )}
      <div className={ui.segmented} role="radiogroup" aria-label="Amount">
        <label>
          <input
            type="radio"
            name="pay-box-kind"
            checked={payerChooses}
            onChange={() => {
              setPayerChooses(true);
            }}
          />
          Payer chooses
        </label>
        <label>
          <input
            type="radio"
            name="pay-box-kind"
            checked={!payerChooses}
            onChange={() => {
              setPayerChooses(false);
            }}
          />
          Fixed amount
        </label>
      </div>
      <div className={styles.amountBox}>
        <label className={ui.label} htmlFor="pay-box-amount">
          {payerChooses ? "At least (optional)" : "Amount"}
        </label>
        <div className={styles.amountRow}>
          <input
            id="pay-box-amount"
            className={styles.amountInput}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
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
          <label className={ui.visuallyHidden} htmlFor="pay-box-asset">
            Asset
          </label>
          <AssetSelect id="pay-box-asset" assets={assets} value={assetId} onChange={setAssetId} />
        </div>
      </div>
      {needsAddress && (
        <p className={ui.notice}>
          Add your {networkName(network)} address under Where you get paid first: the pay box pays
          it.
        </p>
      )}
      {error !== null && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.buttons}>
        <button type="submit" className={ui.primaryButton} disabled={pending || needsAddress}>
          {payBox?.open === true ? "Save pay box" : "Turn on pay box"}
        </button>
        {payBox?.open === true && (
          <button
            type="button"
            className={ui.ghostButton}
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
