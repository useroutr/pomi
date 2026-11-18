"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import ui from "@/app/components/ui.module.css";
import { callApi } from "@/lib/api-client";
import styles from "./dashboard.module.css";

// Claiming the handle that names the receiver's page, on the page card.
export function ClaimHandleForm({ host }: { host: string }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi("/api/me/handle", { method: "POST", body: { handle } });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <form className={styles.claim} onSubmit={(event) => void claim(event)}>
      <label className={ui.visuallyHidden} htmlFor="handle">
        Handle
      </label>
      <div className={styles.claimRow}>
        <span>{host}/</span>
        <input
          id="handle"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          placeholder="your-name"
          value={handle}
          onChange={(event) => {
            setHandle(event.target.value);
          }}
          required
        />
        <button
          type="submit"
          className={[ui.primaryButton, ui.compact].join(" ")}
          disabled={pending}
        >
          {pending ? "Claiming..." : "Claim"}
        </button>
      </div>
      <p className={styles.claimHint}>
        3 to 30 lowercase letters, digits or hyphens. It cannot be changed later.
      </p>
      {error !== null && (
        <p className={styles.claimError} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function DisplayNameForm({ displayName }: { displayName: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(displayName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await callApi("/api/me/display-name", {
      method: "PUT",
      body: { displayName: name },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={(event) => void save(event)}>
      <div className={ui.field}>
        <label className={ui.visuallyHidden} htmlFor="display-name">
          Name shown to payers
        </label>
        <input
          id="display-name"
          className={ui.input}
          maxLength={50}
          placeholder="Ada Lovelace"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSaved(false);
          }}
          required
        />
        <p className={ui.hint}>On your page and on every request you send.</p>
      </div>
      {error !== null && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.buttons}>
        <button type="submit" className={ui.secondaryButton} disabled={pending}>
          {saved ? "Saved" : "Save name"}
        </button>
      </div>
    </form>
  );
}
