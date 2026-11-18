"use client";

import { ADDRESS_WRITING, addressKindOf, networkName, shortenAddress } from "@pomi/shared";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { networkLogo } from "@/app/components/logos";
import ui from "@/app/components/ui.module.css";
import { callApi } from "@/lib/api-client";
import styles from "./dashboard.module.css";

export interface SavedPayoutAddress {
  network: string;
  address: string;
}

// One row per network Pomi pays out on: the receiver's address there, or a
// way to add one. Each network has its own address, written its own way, and
// the server checks it before saving.
export function PayoutAddresses({
  networks,
  saved,
}: {
  networks: string[];
  saved: SavedPayoutAddress[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <ul className={styles.payoutList}>
      {networks.map((network) => {
        const address = saved.find((candidate) => candidate.network === network)?.address;
        const logo = networkLogo(network);
        return (
          <li key={network} className={styles.payoutRow}>
            <div className={styles.payoutHead}>
              {logo !== null && <img src={logo} alt="" />}
              <div className={styles.payoutText}>
                <strong>{networkName(network)}</strong>
                <span className={address === undefined ? undefined : styles.payoutAddress}>
                  {address === undefined ? "No address yet" : shortenAddress(network, address)}
                </span>
              </div>
              {editing !== network && (
                <button
                  type="button"
                  className={[
                    address === undefined ? ui.primaryButton : ui.secondaryButton,
                    ui.compact,
                  ].join(" ")}
                  onClick={() => {
                    setEditing(network);
                  }}
                >
                  {address === undefined ? "Add" : "Change"}
                </button>
              )}
            </div>
            {editing === network && (
              <AddressForm
                network={network}
                onDone={() => {
                  setEditing(null);
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AddressForm({ network, onDone }: { network: string; onDone: () => void }) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writing = ADDRESS_WRITING[addressKindOf(network)];
  const fieldId = `payout-${network}`;

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi("/api/me/payout-address", {
      method: "PUT",
      body: { address, network },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={(event) => void save(event)}>
      <div className={ui.field}>
        <label className={ui.label} htmlFor={fieldId}>
          Your {networkName(network)} address
        </label>
        <input
          id={fieldId}
          className={ui.input}
          placeholder={writing.placeholder}
          autoComplete="off"
          spellCheck={false}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
          required
          autoFocus
        />
        <p className={ui.hint}>
          {writing.hint} Payments go straight to it. Use one from your own wallet, not an exchange.
        </p>
      </div>
      {error !== null && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.buttons}>
        <button type="submit" className={ui.primaryButton} disabled={pending}>
          {pending ? "Checking..." : "Save address"}
        </button>
        <button type="button" className={ui.ghostButton} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
