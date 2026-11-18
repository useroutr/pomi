"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import ui from "@/app/components/ui.module.css";
import { callApi } from "@/lib/api-client";
import styles from "./sign-in.module.css";

type Step = { name: "email" } | { name: "code"; email: string };

export function SignInForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(path: string, body: Record<string, string>): Promise<boolean> {
    setPending(true);
    setError(null);
    const result = await callApi(path, { method: "POST", body });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
    }
    return result.ok;
  }

  async function requestCode(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await submit("/api/auth/code", { email })) {
      setCode("");
      setStep({ name: "code", email });
    }
  }

  async function verifyCode(event: SubmitEvent<HTMLFormElement>, codeEmail: string) {
    event.preventDefault();
    if (await submit("/api/auth/verify", { email: codeEmail, code })) {
      router.replace("/dashboard");
      router.refresh();
    }
  }

  if (step.name === "email") {
    return (
      <>
        <div className={styles.heading}>
          <h1>Sign in to Pomi</h1>
          <p>We will email you a 6-digit code. There is no password to remember.</p>
        </div>
        <form className={styles.form} onSubmit={(event) => void requestCode(event)}>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={ui.input}
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              required
              autoFocus
            />
          </div>
          {error !== null && (
            <p className={ui.error} role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className={[ui.primaryButton, ui.wide].join(" ")}
            disabled={pending}
          >
            {pending ? "Sending..." : "Email me a code"}
          </button>
          <p className={styles.below}>New to Pomi? The same code creates your account.</p>
        </form>
      </>
    );
  }

  return (
    <>
      <div className={styles.heading}>
        <h1>Check your email</h1>
        <p>
          We sent a 6-digit code to <strong>{step.email}</strong>.
        </p>
      </div>
      <form className={styles.form} onSubmit={(event) => void verifyCode(event, step.email)}>
        <div className={ui.field}>
          <label className={ui.visuallyHidden} htmlFor="code">
            Code
          </label>
          <input
            id="code"
            name="code"
            className={[ui.input, styles.codeInput].join(" ")}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            placeholder="000000"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            required
            autoFocus
          />
        </div>
        {error !== null && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={[ui.primaryButton, ui.wide].join(" ")} disabled={pending}>
          {pending ? "Checking..." : "Sign in"}
        </button>
        <button
          type="button"
          className={ui.ghostButton}
          onClick={() => {
            setError(null);
            setStep({ name: "email" });
          }}
        >
          Use another email
        </button>
      </form>
    </>
  );
}
