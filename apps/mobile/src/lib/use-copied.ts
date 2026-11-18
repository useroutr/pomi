import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import { haptics } from "./haptics";

// How long a copy button says "Copied".
const COPIED_MS = 1600;

// Copies text and reports it for a moment, for a button that turns into
// "Copied" and back.
export function useCopied(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const copy = useCallback((text: string) => {
    haptics.select();
    void Clipboard.setStringAsync(text).then(() => {
      setCopied(true);
    });
  }, []);

  return { copied, copy };
}
