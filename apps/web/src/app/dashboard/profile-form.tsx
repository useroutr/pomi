"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { callApi } from "@/lib/api-client";
import { CopyButton } from "./copy-button";

export function ProfileForm({
  handle,
  displayName,
  appUrl,
}: {
  handle: string | null;
  displayName: string | null;
  appUrl: string;
}) {
  const router = useRouter();
  const [handleInput, setHandleInput] = useState("");
  const [nameInput, setNameInput] = useState(displayName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(path: string, method: "POST" | "PUT", body: Record<string, string>) {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await callApi(path, { method, body });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function claimHandle(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit("/api/me/handle", "POST", { handle: handleInput });
  }

  async function saveName(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(await submit("/api/me/display-name", "PUT", { displayName: nameInput }));
  }

  const pageUrl = handle === null ? null : `${appUrl}/${handle}`;

  return (
    <div className="stack">
      {pageUrl === null ? (
        <form className="form" onSubmit={(event) => void claimHandle(event)}>
          <label htmlFor="handle">Handle</label>
          <div className="row">
            <span className="muted">{appUrl.replace(/^https?:\/\//, "")}/</span>
            <input
              id="handle"
              className="grow"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              placeholder="your-name"
              value={handleInput}
              onChange={(event) => {
                setHandleInput(event.target.value);
              }}
              required
            />
          </div>
          <p className="muted small">
            3 to 30 lowercase letters, digits or hyphens. It cannot be changed later.
          </p>
          <button type="submit" disabled={pending}>
            Claim
          </button>
        </form>
      ) : (
        <div className="stack">
          <p className="address">{pageUrl}</p>
          <div className="row">
            <CopyButton text={pageUrl} label="Copy page link" />
            <a className="button-link" href={pageUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          </div>
        </div>
      )}
      <form className="form" onSubmit={(event) => void saveName(event)}>
        <label htmlFor="display-name">Name shown to payers</label>
        <div className="row">
          <input
            id="display-name"
            className="grow"
            maxLength={50}
            placeholder="Ada Lovelace"
            value={nameInput}
            onChange={(event) => {
              setNameInput(event.target.value);
            }}
            required
          />
          <button type="submit" className="secondary" disabled={pending}>
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </form>
      {error !== null && <p className="error">{error}</p>}
    </div>
  );
}
