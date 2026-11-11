"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/api-client";

export function ListingButton({ requestId, listed }: { requestId: string; listed: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    const result = await callApi(`/api/requests/${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      body: { listed: !listed },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button type="button" className="secondary" disabled={pending} onClick={() => void toggle()}>
        {listed ? "Hide from my page" : "Show on my page"}
      </button>
      {error !== null && <span className="error small">{error}</span>}
    </>
  );
}
