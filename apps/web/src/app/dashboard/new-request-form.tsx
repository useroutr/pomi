"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { z } from "zod";
import { callApi } from "@/lib/api-client";
import { CopyButton } from "./copy-button";

const createdSchema = z.object({ request: z.object({ url: z.string() }) });

export interface RequestableAsset {
  id: string;
  symbol: string;
}

export function NewRequestForm({ assets }: { assets: RequestableAsset[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  async function create(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi("/api/requests", {
      method: "POST",
      body: { amount, assetId, note },
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
    router.refresh();
  }

  return (
    <form className="form" onSubmit={(event) => void create(event)}>
      <div className="row">
        <div className="field grow">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="25"
            autoComplete="off"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="asset">Asset</label>
          <select
            id="asset"
            name="asset"
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
      <label htmlFor="note">What it is for (optional)</label>
      <input
        id="note"
        name="note"
        maxLength={280}
        placeholder="Logo design"
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
        }}
      />
      {error !== null && <p className="error">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create request"}
      </button>
      {createdUrl !== null && (
        <div className="created">
          <p className="small">Share this link. Whoever opens it can pay.</p>
          <p className="address">{createdUrl}</p>
          <CopyButton text={createdUrl} />
        </div>
      )}
    </form>
  );
}
