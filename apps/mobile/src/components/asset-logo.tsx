import AQUA from "@web3icons/core/svgs/tokens/background/AQUA.svg.js";
import ARB from "@web3icons/core/svgs/tokens/background/ARB.svg.js";
import BLND from "@web3icons/core/svgs/tokens/background/BLND.svg.js";
import CBBTC from "@web3icons/core/svgs/tokens/background/CBBTC.svg.js";
import DAI from "@web3icons/core/svgs/tokens/background/DAI.svg.js";
import ETH from "@web3icons/core/svgs/tokens/background/ETH.svg.js";
import EURC from "@web3icons/core/svgs/tokens/background/EURC.svg.js";
import LINK from "@web3icons/core/svgs/tokens/background/LINK.svg.js";
import PYUSD from "@web3icons/core/svgs/tokens/background/PYUSD.svg.js";
import SOL from "@web3icons/core/svgs/tokens/background/SOL.svg.js";
import USDC from "@web3icons/core/svgs/tokens/background/USDC.svg.js";
import USDT from "@web3icons/core/svgs/tokens/background/USDT.svg.js";
import XLM from "@web3icons/core/svgs/tokens/background/XLM.svg.js";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { networkInfo } from "@/lib/networks";
import { usePalette } from "@/theme/theme";
import { Text } from "./text";

// Token logos come from web3icons (MIT, github.com/0xa3k5/web3icons): the
// "background" set, a brand mark on its brand color, drawn as a circle. Only
// the logos imported here are bundled. An asset without one gets a monogram.
const LOGOS: Record<string, string> = {
  USDC,
  XLM,
  EURC,
  ETH,
  USDT,
  CBBTC,
  DAI,
  LINK,
  ARB,
  SOL,
  // Stellar's own, for networks and tokens Useroutr lists there.
  AQUA,
  BLND,
  PYUSD,
};

// Wrapped and bridged forms carry the mark of the asset they stand for, as
// wallets show them.
const SAME_MARK_AS: Record<string, string> = { WETH: "ETH", USDT0: "USDT" };

export function AssetLogo({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const upper = symbol.toUpperCase();
  const logo = LOGOS[SAME_MARK_AS[upper] ?? upper] ?? null;
  return <Badge logo={logo} label={symbol} size={size} />;
}

export function NetworkLogo({ network, size = 28 }: { network: string; size?: number }) {
  const info = networkInfo(network);
  return <Badge logo={info.logo} label={info.name} size={size} />;
}

// A token with the network it is on, as wallets show it: the token's logo
// with the network's in its corner, cut out by a ring of the color behind.
export function AssetMark({
  symbol,
  network,
  size = 40,
  ringColor,
}: {
  symbol: string;
  network: string;
  size?: number;
  ringColor: string;
}) {
  const badge = Math.round(size * 0.46);
  return (
    <View accessible={false} style={{ width: size, height: size }}>
      <AssetLogo symbol={symbol} size={size} />
      <View
        style={[
          styles.corner,
          { borderRadius: badge, borderColor: ringColor, right: -3, bottom: -3 },
        ]}
      >
        <NetworkLogo network={network} size={badge} />
      </View>
    </View>
  );
}

// Overlapping network logos, as payment apps show the cards or banks they take.
export function NetworkStack({
  networks,
  size = 28,
  ringColor,
}: {
  networks: string[];
  size?: number;
  // The color behind the stack, so each logo is cut out from the one before.
  ringColor: string;
}) {
  return (
    <View style={styles.stack} accessible={false}>
      {networks.map((network, index) => (
        <View
          key={network}
          style={{
            marginLeft: index === 0 ? 0 : -size * 0.28,
            borderRadius: size,
            borderWidth: 2,
            borderColor: ringColor,
          }}
        >
          <NetworkLogo network={network} size={size} />
        </View>
      ))}
    </View>
  );
}

function Badge({ logo, label, size }: { logo: string | null; label: string; size: number }) {
  const palette = usePalette();
  return (
    <View
      accessible={false}
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.fill,
          // A hairline keeps a black XLM or Stellar badge visible on the dark theme.
          borderColor: palette.scheme === "dark" ? palette.line : "transparent",
        },
      ]}
    >
      {logo === null ? (
        <Text variant="caption" tone="secondary">
          {label.slice(0, size < 32 ? 2 : 4)}
        </Text>
      ) : (
        <SvgXml xml={logo} width={size} height={size} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  stack: { flexDirection: "row", alignItems: "center" },
  corner: { position: "absolute", borderWidth: 2 },
});
