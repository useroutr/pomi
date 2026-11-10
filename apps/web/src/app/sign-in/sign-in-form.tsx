"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { z } from "zod";

const errorBodySchema = z.object({ error: z.object({ message: z.string() }) });

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
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        return true;
      }
      setError(await errorMessage(response));
      return false;
    } catch {
      setError("Pomi could not be reached. Check your connection and try again.");
      return false;
    } finally {
      setPending(false);
    }
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

async function errorMessage(response: Response): Promise<string> {
  try {
    const parsed = errorBodySchema.safeParse(await response.json());
    if (parsed.success) {
      return parsed.data.error.message;
    }
  } catch {
    // Not JSON: fall through to the generic message.
  }
  return "Something went wrong. Try again.";
}
