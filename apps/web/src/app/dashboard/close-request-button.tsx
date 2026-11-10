"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/api-client";

export function CloseRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setPending(true);
    setError(null);
    const result = await callApi(`/api/requests/${encodeURIComponent(requestId)}/close`, {
      method: "POST",
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
      <button type="button" className="secondary" disabled={pending} onClick={() => void close()}>
        Close
      </button>
      {error !== null && <span className="error small">{error}</span>}
    </>
  );
}
