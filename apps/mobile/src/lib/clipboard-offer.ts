import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

export type ClipboardOffer =
  // iOS 16 and later: reading the clipboard unasked shows the system's "Allow
  // Paste" alert, so the app only learns that something was copied and offers
  // Apple's Paste control, which reads it when tapped, without the alert.
  | { kind: "paste-control" }
  // Elsewhere the clipboard can be read quietly, so the offer names what it
  // found.
  | { kind: "found"; value: string };

// Offers to paste what was copied in another app (a sign-in code from Mail,
// an address from a wallet), checked whenever the screen is shown or the app
// comes back to the front. `find` must be a stable function.
export function useClipboardOffer(
  find: (text: string) => string | null,
  enabled: boolean,
): { offer: ClipboardOffer | null; dismiss: () => void } {
  const [offer, setOffer] = useState<ClipboardOffer | null>(null);

  const look = useCallback(async () => {
    if (!enabled) {
      setOffer(null);
      return;
    }
    if (Clipboard.isPasteButtonAvailable) {
      setOffer((await Clipboard.hasStringAsync()) ? { kind: "paste-control" } : null);
      return;
    }
    const value = find(await Clipboard.getStringAsync());
    setOffer(value === null ? null : { kind: "found", value });
  }, [enabled, find]);

  useFocusEffect(
    useCallback(() => {
      void look();
    }, [look]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void look();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [look]);

  const dismiss = useCallback(() => {
    setOffer(null);
  }, []);

  return { offer, dismiss };
}
