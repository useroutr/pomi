"use client";

import { useState } from "react";
import ui from "@/app/components/ui.module.css";

export function CopyButton({
  text,
  label = "Copy link",
  className = [ui.secondaryButton, ui.compact].join(" "),
}: {
  text: string;
  label?: string;
  className?: string;
}) {
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
    <button type="button" className={className} onClick={() => void copy()}>
      {copied ? "Copied" : label}
    </button>
  );
}
