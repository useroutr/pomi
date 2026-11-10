"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard access can be refused; the link is on screen to copy by hand.
      setCopied(false);
    }
  }

  return (
    <button type="button" className="secondary" onClick={() => void copy()}>
      {copied ? "Copied" : label}
    </button>
  );
}
