"use client";

import { networkName } from "@pomi/shared";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { z } from "zod";
import ui from "@/app/components/ui.module.css";
import { callApi } from "@/lib/api-client";
import { AssetSelect, type RequestableAsset } from "./asset-select";
import { CopyButton } from "./copy-button";
import styles from "./dashboard.module.css";

const createdSchema = z.object({ request: z.object({ url: z.string() }) });

// What can be typed as an amount while it is being typed; the server checks
// the finished amount.
const AMOUNT_TYPING = /^\d{0,12}(\.\d{0,7})?$/;

export function NewRequestForm({
  assets,
  addressNetworks,
}: {
  assets: RequestableAsset[];
  // Networks the receiver has an address on: a request pays that address.
  addressNetworks: string[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  // Starts on an asset the receiver can already be paid in.
  const [assetId, setAssetId] = useState(
    (assets.find((asset) => addressNetworks.includes(asset.network)) ?? assets[0])?.id ?? "",
  );
  const [note, setNote] = useState("");
  const [reusable, setReusable] = useState(false);
  const [listed, setListed] = useState(false);
  const [endsAt, setEndsAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const network = assets.find((asset) => asset.id === assetId)?.network;
  const needsAddress = network !== undefined && !addressNetworks.includes(network);

  async function create(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi("/api/requests", {
      method: "POST",
      body: {
        amount,
        assetId,
        note,
        reusable,
        listed,
        // datetime-local has no zone: it is the receiver's local time.
        ...(endsAt === "" ? {} : { endsAt: new Date(endsAt).toISOString() }),
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const created = createdSchema.safeParse(result.body);
    setCreatedUrl(created.success ? created.data.request.url : null);
    setAmount("");
    setNote("");
    setEndsAt("");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={(event) => void create(event)}>
      <div className={styles.amountBox}>
        <label className={ui.label} htmlFor="amount">
          You ask for
        </label>
        <div className={styles.amountRow}>
          <input
            id="amount"
            name="amount"
            className={styles.amountInput}
            inputMode="decimal"
            placeholder="0"
            autoComplete="off"
            value={amount}
            onChange={(event) => {
              const typed = event.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
              if (AMOUNT_TYPING.test(typed)) {
                setAmount(typed);
              }
            }}
            required
          />
          <label className={ui.visuallyHidden} htmlFor="asset">
            Asset
          </label>
          <AssetSelect id="asset" assets={assets} value={assetId} onChange={setAssetId} />
        </div>
      </div>
      <div className={ui.field}>
        <label className={ui.label} htmlFor="note">
          What it is for <span className={ui.hint}>(optional)</span>
        </label>
        <input
          id="note"
          name="note"
          className={ui.input}
          maxLength={280}
          placeholder="Logo design"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </div>
      <div className={styles.toggles}>
        <label className={ui.switchRow}>
          <span>
            Reusable
            <small>Anyone can pay it, any number of times</small>
          </span>
          <input
            type="checkbox"
            className={ui.switch}
            checked={reusable}
            onChange={(event) => {
              setReusable(event.target.checked);
            }}
          />
        </label>
        <label className={ui.switchRow}>
          <span>
            Show on my page
            <small>Listed for everyone who opens your page</small>
          </span>
          <input
            type="checkbox"
            className={ui.switch}
            checked={listed}
            onChange={(event) => {
              setListed(event.target.checked);
            }}
          />
        </label>
      </div>
      <div className={ui.field}>
        <label className={ui.label} htmlFor="ends-at">
          Ends <span className={ui.hint}>(optional)</span>
        </label>
        <input
          id="ends-at"
          type="datetime-local"
          className={ui.input}
          value={endsAt}
          onChange={(event) => {
            setEndsAt(event.target.value);
          }}
        />
      </div>
      {needsAddress && (
        <p className={ui.notice}>
          Add your {networkName(network)} address under Where you get paid first: a request on{" "}
          {networkName(network)} pays it.
        </p>
      )}
      {error !== null && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className={[ui.primaryButton, ui.wide].join(" ")}
        disabled={pending || needsAddress}
      >
        {pending ? "Creating..." : "Create request"}
      </button>
      {createdUrl !== null && (
        <div className={styles.created} role="status">
          <p>Created. Share this link; whoever opens it can pay.</p>
          <span className={styles.createdLink}>{createdUrl}</span>
          <div className={styles.buttons}>
            <CopyButton text={createdUrl} />
          </div>
        </div>
      )}
    </form>
  );
}
