"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { callApi } from "@/lib/api-client";

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
      <div className="stack">
        <p className="address">{current}</p>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setEditing(true);
          }}
        >
          Change address
        </button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={(event) => void save(event)}>
      <label htmlFor="payout-address">Your Stellar address</label>
      <input
        id="payout-address"
        name="address"
        placeholder="G..."
        autoComplete="off"
        spellCheck={false}
        value={address}
        onChange={(event) => {
          setAddress(event.target.value);
        }}
        required
      />
      <p className="muted small">
        Payments go straight to this account. Use one from your own wallet, not an exchange.
      </p>
      {error !== null && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={pending}>
          {pending ? "Checking..." : "Save address"}
        </button>
        {current !== null && (
          <button
            type="button"
            className="secondary"
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
