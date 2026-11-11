"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { callApi } from "@/lib/api-client";

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
      <form className="form" onSubmit={(event) => void requestCode(event)}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          required
          autoFocus
        />
        {error !== null && <p className="error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Sending..." : "Email me a code"}
        </button>
      </form>
    );
  }

  return (
    <form className="form" onSubmit={(event) => void verifyCode(event, step.email)}>
      <p className="muted">We sent a 6-digit code to {step.email}.</p>
      <label htmlFor="code">Code</label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        value={code}
        onChange={(event) => {
          setCode(event.target.value);
        }}
        required
        autoFocus
      />
      {error !== null && <p className="error">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Checking..." : "Sign in"}
      </button>
      <button
        type="button"
        className="link"
        onClick={() => {
          setError(null);
          setStep({ name: "email" });
        }}
      >
        Use another email
      </button>
    </form>
  );
}
