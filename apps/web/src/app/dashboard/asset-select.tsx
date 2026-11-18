import { networkName } from "@pomi/shared";
import { TokenMark } from "@/app/components/token-mark";
import ui from "@/app/components/ui.module.css";
import styles from "./dashboard.module.css";

export interface RequestableAsset {
  id: string;
  symbol: string;
  network: string;
}

// A native select, so it works with every keyboard and screen reader, with
// the chosen token's logo drawn over its left edge.
export function AssetSelect({
  id,
  assets,
  value,
  onChange,
}: {
  id: string;
  assets: RequestableAsset[];
  value: string;
  onChange: (assetId: string) => void;
}) {
  const chosen = assets.find((asset) => asset.id === value) ?? assets[0];
  return (
    <span className={styles.assetPick}>
      {chosen !== undefined && (
        <TokenMark symbol={chosen.symbol} network={chosen.network} size={30} />
      )}
      <select
        id={id}
        className={[ui.select, styles.assetSelect].join(" ")}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.symbol} · {networkName(asset.network)}
          </option>
        ))}
      </select>
    </span>
  );
}
