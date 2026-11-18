import { type CSSProperties } from "react";
import { networkLogo, tokenLogo } from "./logos";
import ui from "./ui.module.css";

// A token's logo with its network's in the corner, as wallets draw tokens. A
// token without a logo gets its initials.
export function TokenMark({
  symbol,
  network,
  size = 32,
}: {
  symbol: string;
  network: string;
  size?: number;
}) {
  const token = tokenLogo(symbol);
  const badge = networkLogo(network);
  const sized: CSSProperties & Record<"--mark", string> = { "--mark": `${String(size)}px` };
  return (
    <span className={ui.tokenMark} style={sized} aria-hidden="true">
      {token === null ? (
        <span className={ui.tokenMonogram}>{symbol.slice(0, 2)}</span>
      ) : (
        // Plain images: next/image adds nothing for small inline SVGs.
        <img src={token} alt="" />
      )}
      {badge !== null && <img className={ui.tokenBadge} src={badge} alt="" />}
    </span>
  );
}
