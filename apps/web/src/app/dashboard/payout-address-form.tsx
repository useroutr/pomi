"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { networkLogo } from "@/app/components/logos";
import ui from "@/app/components/ui.module.css";
import { callApi } from "@/lib/api-client";
import styles from "./dashboard.module.css";

const stellarLogo = networkLogo("stellar");

export function PayoutAddressForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(current === null);
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi("/api/me/payout-address", { method: "PUT", body: { address } });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditing(false);
    setAddress("");
    router.refresh();
  }

  if (!editing && current !== null) {
    return (
      <div className={styles.form}>
        <div className={styles.address}>
          {stellarLogo !== null && <img src={stellarLogo} alt="" />}
          <code>{current}</code>
        </div>
        <div className={styles.buttons}>
          <button
            type="button"
            className={ui.secondaryButton}
            onClick={() => {
              setEditing(true);
            }}
          >
            Change address
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={(event) => void save(event)}>
      <div className={ui.field}>
        <label className={ui.label} htmlFor="payout-address">
          Your Stellar address
        </label>
        <input
          id="payout-address"
          name="address"
          className={ui.input}
          placeholder="G..."
          autoComplete="off"
          spellCheck={false}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
          required
        />
        <p className={ui.hint}>
          Payments go straight to this account. Use one from your own wallet, not an exchange.
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
        {current !== null && (
          <button
            type="button"
            className={ui.ghostButton}
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
