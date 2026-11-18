"use client";

import { networkList, networkName } from "@pomi/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./landing.module.css";

export interface AskOption {
  symbol: string;
  network: string;
  tokenLogo: string | null;
  networkLogo: string | null;
}

export interface PayWithNetwork {
  network: string;
  logo: string | null;
}

type Mode = "request" | "payBox";

// What asking for money looks like, laid out as Uniswap lays out a swap: what
// you ask for on top, what the payer brings below, one button. Nothing is
// created here; the button leads to sign-in.
export function AskCard({ options, payWith }: { options: AskOption[]; payWith: PayWithNetwork[] }) {
  const [mode, setMode] = useState<Mode>("request");
  const [amount, setAmount] = useState("25");
  const [choice, setChoice] = useState(0);
  const [picking, setPicking] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const asset = options[choice] ?? options[0];
  const networks = payWith.map((entry) => entry.network);

  useEffect(() => {
    if (!picking) {
      return;
    }
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && pickerRef.current?.contains(event.target) !== true) {
        setPicking(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPicking(false);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [picking]);

  return (
    <div className={styles.askCard}>
      <div className={styles.askTabs} role="tablist" aria-label="Kind of link">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "request"}
          className={mode === "request" ? styles.askTabOn : styles.askTab}
          onClick={() => {
            setMode("request");
          }}
        >
          Request
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "payBox"}
          className={mode === "payBox" ? styles.askTabOn : styles.askTab}
          onClick={() => {
            setMode("payBox");
          }}
        >
          Pay box
        </button>
      </div>

      <div className={styles.askBox}>
        <span className={styles.askLabel}>
          {mode === "request" ? "You ask for" : "Payers choose the amount, from"}
        </span>
        <div className={styles.askRow}>
          <input
            className={styles.askAmount}
            inputMode="decimal"
            aria-label="Amount"
            value={amount}
            onChange={(event) => {
              const next = event.target.value.replace(/[^0-9.]/g, "");
              if (/^\d{0,9}(\.\d{0,6})?$/.test(next)) {
                setAmount(next);
              }
            }}
            placeholder="0"
          />
          {asset !== undefined && (
            <div className={styles.pickerWrap} ref={pickerRef}>
              <button
                type="button"
                className={styles.assetPill}
                aria-haspopup="listbox"
                aria-expanded={picking}
                onClick={() => {
                  setPicking(!picking);
                }}
              >
                <TokenMark option={asset} />
                <span>
                  {asset.symbol}
                  <small>{networkName(asset.network)}</small>
                </span>
                <span className={styles.chevron} aria-hidden="true" />
              </button>
              {picking && (
                <ul className={styles.picker} role="listbox" aria-label="Get paid in">
                  {options.map((option, index) => (
                    <li key={`${option.symbol}-${option.network}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === choice}
                        className={styles.pickerOption}
                        onClick={() => {
                          setChoice(index);
                          setPicking(false);
                        }}
                      >
                        <TokenMark option={option} />
                        <span>
                          {option.symbol}
                          <small>on {networkName(option.network)}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.askSwap} aria-hidden="true">
        <span />
      </div>

      <div className={[styles.askBox, styles.askBoxQuiet].join(" ")}>
        <span className={styles.askLabel}>They pay with</span>
        <div className={styles.askRow}>
          <span className={styles.askAny}>Any token</span>
          {payWith.length > 0 && (
            <span className={styles.stack} title={networkList(networks)}>
              {payWith
                .slice(0, 4)
                .map((entry) =>
                  entry.logo === null ? null : <img key={entry.network} src={entry.logo} alt="" />,
                )}
            </span>
          )}
        </div>
        {networks.length > 0 && (
          <span className={styles.askHint}>From {networkList(networks)}</span>
        )}
      </div>

      <Link className={styles.askButton} href="/sign-in">
        Create your link
      </Link>
      <p className={styles.askFoot}>It lands in your own wallet. Pomi never holds it.</p>
    </div>
  );
}

function TokenMark({ option }: { option: AskOption }) {
  return (
    <span className={styles.tokenMark} aria-hidden="true">
      {option.tokenLogo !== null && <img src={option.tokenLogo} alt="" />}
      {option.networkLogo !== null && (
        <img className={styles.tokenBadge} src={option.networkLogo} alt="" />
      )}
    </span>
  );
}
