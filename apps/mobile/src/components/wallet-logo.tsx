import Coinbase from "@web3icons/core/svgs/wallets/background/coinbase.svg.js";
import Lobstr from "@web3icons/core/svgs/wallets/background/lobstr.svg.js";
import MetaMask from "@web3icons/core/svgs/wallets/background/metamask.svg.js";
import Varial from "@web3icons/core/svgs/wallets/background/varial.svg.js";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";

// Wallet marks from web3icons (MIT), the "background" set: each on its own
// app-icon color, so a square with rounded corners reads as the app itself.
// The Stellar wallets arrived in web3icons 4.0.60.
const WALLETS = {
  lobstr: Lobstr,
  varial: Varial,
  metamask: MetaMask,
  coinbase: Coinbase,
} as const;

export type WalletId = keyof typeof WALLETS;

export function WalletLogo({ wallet, size = 40 }: { wallet: WalletId; size?: number }) {
  return (
    <View
      accessible={false}
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.26 }]}
    >
      <SvgXml xml={WALLETS[wallet]} width={size} height={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: "hidden" },
});
