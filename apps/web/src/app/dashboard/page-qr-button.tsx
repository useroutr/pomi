"use client";

import { useRef } from "react";
import { QrCard } from "@/app/components/qr-card";
import ui from "@/app/components/ui.module.css";
import styles from "./dashboard.module.css";

// The page's QR card in a dialog, to show at a counter or to screenshot and
// print. A native dialog: it traps focus and closes on Escape.
export function PageQrButton({ link, label, name }: { link: string; label: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className={ui.glassButton}
        onClick={() => {
          dialog.current?.showModal();
        }}
      >
        QR code
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="qr-title"
        onClick={(event) => {
          // A click on the backdrop lands on the dialog itself.
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        <div className={styles.dialogBody}>
          <h2 id="qr-title">Your page&apos;s QR code</h2>
          <QrCard
            link={link}
            label={label}
            name={name}
            initial={Array.from(name.trim())[0] ?? "?"}
          />
          <p className={ui.hint}>
            Payers scan it to open your page. Screenshot it to print or share.
          </p>
          <button
            type="button"
            className={[ui.secondaryButton, ui.wide].join(" ")}
            onClick={() => {
              dialog.current?.close();
            }}
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
