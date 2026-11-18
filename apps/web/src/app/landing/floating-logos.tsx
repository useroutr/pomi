import { type CSSProperties } from "react";
import styles from "./landing.module.css";
import { networkLogo, tokenLogo, walletLogo } from "@/app/components/logos";

// CSS custom properties the stylesheet reads for each logo.
type FloaterStyle = CSSProperties & Record<`--${string}`, string>;

interface Floater {
  logo: string | null;
  // Where it sits in the hero, in percent of its width and height.
  x: number;
  y: number;
  // 0 is far (small, blurred, faint), 1 is near (large and sharp), as
  // Uniswap scatters tokens behind its swap card.
  depth: number;
  // Seconds, so the drift never lines up.
  drift: number;
  // Where it sits on phones, at the edges beside the card so it never meets
  // the headline. Logos without one show only on wider screens.
  phone?: { x: number; y: number };
}

const FLOATERS: Floater[] = [
  { logo: tokenLogo("USDC"), x: 9, y: 22, depth: 0.95, drift: 9, phone: { x: 9, y: 96 } },
  { logo: networkLogo("stellar"), x: 19, y: 58, depth: 0.55, drift: 11 },
  { logo: tokenLogo("ETH"), x: 6, y: 78, depth: 0.25, drift: 13 },
  { logo: walletLogo("lobstr"), x: 24, y: 10, depth: 0.15, drift: 12 },
  { logo: tokenLogo("XLM"), x: 30, y: 84, depth: 0.7, drift: 10 },
  { logo: networkLogo("polygon"), x: 88, y: 18, depth: 0.85, drift: 10, phone: { x: 95, y: 3 } },
  { logo: tokenLogo("USDT"), x: 78, y: 52, depth: 0.45, drift: 14 },
  { logo: walletLogo("varial"), x: 93, y: 70, depth: 0.75, drift: 9 },
  { logo: networkLogo("arbitrum"), x: 72, y: 8, depth: 0.2, drift: 13 },
  { logo: tokenLogo("EURC"), x: 68, y: 86, depth: 0.3, drift: 12 },
  { logo: walletLogo("metamask"), x: 84, y: 40, depth: 0.1, drift: 15 },
  { logo: tokenLogo("BLND"), x: 14, y: 40, depth: 0.08, drift: 14 },
];

function floaterStyle(floater: Floater, index: number): FloaterStyle {
  const phone = floater.phone ?? { x: floater.x, y: floater.y };
  return {
    "--x": `${String(floater.x)}%`,
    "--y": `${String(floater.y)}%`,
    "--phone-x": `${String(phone.x)}%`,
    "--phone-y": `${String(phone.y)}%`,
    "--size": `${String(Math.round(36 + floater.depth * 52))}px`,
    "--blur": `${String(Math.round((1 - floater.depth) * 7))}px`,
    "--fade": String(0.45 + floater.depth * 0.5),
    "--drift": `${String(floater.drift)}s`,
    "--delay": `${String(-index * 1.3)}s`,
  };
}

// Decoration only: the words beside them say the same thing.
export function FloatingLogos() {
  return (
    <div className={styles.floaters} aria-hidden="true">
      {FLOATERS.map((floater, index) =>
        floater.logo === null ? null : (
          <span
            key={floater.logo}
            className={
              floater.phone === undefined
                ? [styles.floater, styles.wideOnly].join(" ")
                : styles.floater
            }
            style={floaterStyle(floater, index)}
          >
            {/* Plain images: next/image adds nothing for small inline SVGs. */}
            <img src={floater.logo} alt="" />
          </span>
        ),
      )}
    </div>
  );
}
