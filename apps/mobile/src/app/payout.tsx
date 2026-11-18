import { networkName } from "@pomi/shared";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { NetworkLogo } from "@/components/asset-logo";
import { Button, IconButton } from "@/components/button";
import { Field } from "@/components/field";
import { Icon } from "@/components/icon";
import { Illustration } from "@/components/illustration";
import { PasteOffer } from "@/components/paste-offer";
import { PressableScale } from "@/components/pressable-scale";
import { Screen, ScreenHeader } from "@/components/screen";
import { Steps } from "@/components/steps";
import { Text } from "@/components/text";
import { type WalletId, WalletLogo } from "@/components/wallet-logo";
import { addressFormat } from "@/lib/address-format";
import { assetsSchema, payoutAddressSchema, type Readiness, readinessSchema } from "@/lib/api";
import { useClipboardOffer } from "@/lib/clipboard-offer";
import { haptics } from "@/lib/haptics";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import { radius, usePalette } from "@/theme/theme";

// Where a receiver is paid on one network. Used as the last onboarding step,
// where the receiver picks the network, and from You for one network.
export default function PayoutScreen() {
  const params = useLocalSearchParams<{
    onboarding?: string;
    address?: string;
    network?: string;
  }>();
  const onboarding = params.onboarding === "1";
  const { api } = useSession();
  const [network, setNetwork] = useState(params.network ?? "stellar");
  // Opened without a network (onboarding, or Home before any address is
  // saved), the receiver picks the one their wallet is on.
  const [choosing] = useState(params.network === undefined);
  const [address, setAddress] = useState("");
  // A scanned code is read by the camera, so it cannot carry a typo.
  const [checksummed, setChecksummed] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const format = addressFormat(network);
  const name = networkName(network);
  const valid = format.isValid(address);
  const { offer } = useClipboardOffer(format.find, readiness === null && !valid);
  const assets = useApi("/api/assets", assetsSchema);
  const payoutNetworks = [...new Set(assets.data?.assets.map((asset) => asset.network) ?? [])];
  const symbolsHere = (assets.data?.assets ?? [])
    .filter((asset) => asset.network === network)
    .map((asset) => asset.symbol);

  // A scanned address comes back as parameters.
  useEffect(() => {
    if (params.address !== undefined) {
      setNetwork(params.network ?? "stellar");
      setAddress(params.address);
      setChecksummed(true);
      setReadiness(null);
    }
  }, [params.address, params.network]);

  function chooseNetwork(next: string) {
    setNetwork(next);
    setAddress("");
    setReadiness(null);
    setError(null);
  }

  function finish() {
    if (onboarding) {
      router.replace("/home");
    } else {
      router.back();
    }
  }

  async function check() {
    setPending(true);
    setError(null);
    const saved = await api.put(
      "/api/me/payout-address",
      { address, network },
      payoutAddressSchema,
    );
    if (!saved.ok) {
      setPending(false);
      haptics.warning();
      setError(saved.message);
      return;
    }
    const result = await api.get("/api/me/payout-address/readiness", readinessSchema);
    setPending(false);
    haptics.success();
    if (result.ok) {
      setReadiness(result.value);
    } else {
      finish();
    }
  }

  function changeAddress(text: string) {
    // A paste can bring a sentence or a wallet's payment link around it.
    setAddress(format.normalize(text));
    setChecksummed(format.carriesChecksum(text));
    setReadiness(null);
    setError(null);
  }

  function pasteFromClipboard(text: string) {
    const found = format.find(text);
    if (found === null) {
      haptics.warning();
      setError(`What you copied isn't a ${name} address. Copy it again from your wallet.`);
      return;
    }
    haptics.select();
    // The copied text, not the address found in it, says whether it carried
    // a checksum.
    changeAddress(text);
  }

  return (
    <Screen
      footer={
        readiness === null ? (
          <>
            <Button
              title="Check this address"
              pending={pending}
              disabled={!valid}
              onPress={() => void check()}
            />
            {onboarding && (
              <Button title="I'll add it later" variant="plain" size="medium" onPress={finish} />
            )}
          </>
        ) : (
          <Button title={onboarding ? "Start using Pomi" : "Done"} onPress={finish} />
        )
      }
    >
      <ScreenHeader
        leading={
          onboarding ? undefined : (
            <IconButton
              icon="back"
              label="Back"
              onPress={() => {
                router.back();
              }}
            />
          )
        }
        trailing={onboarding ? <Steps current={4} /> : undefined}
      />
      <View style={styles.intro}>
        <Text variant="title" accessibilityRole="header">
          {choosing ? "Where should your money land?" : `Your ${name} address`}
        </Text>
        <Text variant="body" tone="secondary">
          {choosing
            ? "Pick the network your wallet is on. Payers can pay from any network Pomi supports, and it all arrives in your own wallet. Pomi never holds it."
            : symbolsHere.length > 0
              ? `Requests in ${symbolsHere.join(" or ")} on ${name} pay this address. It's your own wallet, and Pomi never holds your money.`
              : `Requests on ${name} pay this address. It's your own wallet, and Pomi never holds your money.`}
        </Text>
      </View>

      {choosing && payoutNetworks.length > 1 && (
        <NetworkChoice networks={payoutNetworks} value={network} onChange={chooseNetwork} />
      )}

      <Field
        label={`${name} address`}
        value={address}
        onChangeText={changeAddress}
        placeholder={format.placeholder}
        autoCapitalize={format.autoCapitalize}
        autoCorrect={false}
        spellCheck={false}
        error={error}
        accessory={
          <IconButton
            icon="scan"
            label="Scan your wallet's QR code"
            size={36}
            tone="surface"
            onPress={() => {
              router.push({
                pathname: "/scan",
                params: { for: "address", onboarding: onboarding ? "1" : "0" },
              });
            }}
          />
        }
        hint={address.length > 0 && !valid ? format.hint : undefined}
      />

      {offer !== null && (
        <PasteOffer
          offer={offer}
          title="Copied your address?"
          description={
            offer.kind === "found"
              ? `Paste ${format.shorten(offer.value)} from your clipboard.`
              : "Paste it from your wallet app."
          }
          onPaste={pasteFromClipboard}
        />
      )}

      {readiness !== null && (
        <Checks readiness={readiness} network={network} checksummed={checksummed} />
      )}

      {readiness === null && <NoWalletYet network={network} />}
    </Screen>
  );
}

// The networks Pomi can pay a receiver on, as Useroutr lists them.
function NetworkChoice({
  networks,
  value,
  onChange,
}: {
  networks: string[];
  value: string;
  onChange: (network: string) => void;
}) {
  const palette = usePalette();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel="Your wallet's network"
      contentContainerStyle={styles.networkRow}
    >
      {networks.map((candidate) => {
        const selected = candidate === value;
        return (
          <PressableScale
            key={candidate}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                haptics.select();
                onChange(candidate);
              }
            }}
            style={[
              styles.networkChip,
              {
                backgroundColor: palette.surface,
                borderColor: selected ? palette.focus : palette.line,
                borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <NetworkLogo network={candidate} size={24} />
            <Text variant="headline">{networkName(candidate)}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

interface WalletLinks {
  wallets: readonly { id: WalletId; name: string; detail: string; url: string }[];
  more: { title: string; url: string };
}

// Free wallets that hold a Stellar address. Varial is the wallet formerly
// called Freighter (freighter.app now redirects to it).
const STELLAR_WALLETS: WalletLinks = {
  wallets: [
    { id: "lobstr", name: "LOBSTR", detail: "iPhone, Android and web", url: "https://lobstr.co" },
    {
      id: "varial",
      name: "Varial",
      detail: "iPhone, Android and browser",
      url: "https://varialwallet.com",
    },
  ],
  more: {
    title: "More Stellar wallets",
    url: "https://stellar.org/learn/wallets-to-store-send-and-receive-lumens",
  },
};

// Free wallets with one address for Base, Arbitrum, Ethereum and the other
// EVM networks. base.app is Coinbase Wallet's own site.
const EVM_WALLETS: WalletLinks = {
  wallets: [
    {
      id: "metamask",
      name: "MetaMask",
      detail: "iPhone, Android and browser",
      url: "https://metamask.com",
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      detail: "iPhone, Android and browser",
      url: "https://base.app",
    },
  ],
  more: { title: "More wallets", url: "https://ethereum.org/wallets/find-wallet/" },
};

function NoWalletYet({ network }: { network: string }) {
  const palette = usePalette();
  const links = network === "stellar" ? STELLAR_WALLETS : EVM_WALLETS;
  return (
    <View style={[styles.help, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <View style={styles.helpTop}>
        <Illustration name="wallet" size={64} />
        <View style={styles.helpText}>
          <Text variant="headline">No wallet yet?</Text>
          <Text variant="callout" tone="secondary">
            A free one takes two minutes. Copy its address, then come back.
          </Text>
        </View>
      </View>
      {links.wallets.map((wallet) => (
        <PressableScale
          key={wallet.name}
          accessibilityRole="link"
          accessibilityHint={`Opens ${wallet.url}`}
          onPress={() => void WebBrowser.openBrowserAsync(wallet.url)}
          style={[styles.walletRow, { backgroundColor: palette.fill }]}
        >
          <WalletLogo wallet={wallet.id} size={36} />
          <View style={styles.helpText}>
            <Text variant="headline">{wallet.name}</Text>
            <Text variant="footnote" tone="secondary">
              {wallet.detail}
            </Text>
          </View>
          <Icon name="external" size={14} color={palette.textTertiary} />
        </PressableScale>
      ))}
      <Button
        title={links.more.title}
        variant="plain"
        size="small"
        icon="external"
        onPress={() => void WebBrowser.openBrowserAsync(links.more.url)}
      />
    </View>
  );
}

// What the server checked when it saved the address. A Stellar account is
// read from the network; an EVM address can only be checked for how it is
// written, so it says no more than that.
function Checks({
  readiness,
  network,
  checksummed,
}: {
  readiness: Readiness;
  network: string;
  checksummed: boolean;
}) {
  const palette = usePalette();
  const name = networkName(network);
  const address = readiness.payoutAddresses.find((saved) => saved.network === network)?.address;
  return (
    <View
      accessibilityLabel="Checks on this address"
      style={[styles.checks, { backgroundColor: palette.surface, borderColor: palette.line }]}
    >
      {address !== undefined && (
        <View style={styles.checkedAddress}>
          <NetworkLogo network={network} size={20} />
          <Text variant="label" tone="secondary">
            {addressFormat(network).shorten(address)}
          </Text>
        </View>
      )}
      {network === "stellar" ? (
        <>
          <CheckLine ok text="The account exists on Stellar" />
          <CheckLine ok text="It's your own wallet, not an exchange that needs a memo" />
        </>
      ) : checksummed ? (
        <CheckLine ok text="Its checksum matches, so there's no typo in it" />
      ) : (
        <CheckLine
          ok={false}
          text={`Written all in one case, so it has no checksum and Pomi can't catch a typo. Compare it with your wallet before you share a ${name} request.`}
        />
      )}
      {readiness.assets
        .filter((asset) => asset.network === network)
        .map((asset) => (
          <CheckLine
            key={asset.id}
            ok={asset.ready}
            text={
              asset.ready
                ? `Ready to be paid in ${asset.symbol}`
                : (asset.problem ?? `${asset.symbol} isn't ready yet.`)
            }
          />
        ))}
    </View>
  );
}

function CheckLine({ ok, text }: { ok: boolean; text: string }) {
  const palette = usePalette();
  return (
    <View style={styles.checkLine}>
      <Icon
        name={ok ? "checkCircle" : "warning"}
        size={20}
        color={ok ? palette.paid.foreground : palette.waiting.foreground}
      />
      <Text variant="callout" style={styles.checkText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10, paddingTop: 8 },
  helpTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.field,
  },
  help: {
    gap: 10,
    padding: 16,
    borderRadius: radius.row,
    borderWidth: StyleSheet.hairlineWidth,
  },
  helpText: { flex: 1, gap: 2 },
  checks: { gap: 12, padding: 16, borderRadius: radius.row, borderWidth: StyleSheet.hairlineWidth },
  checkedAddress: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkLine: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  networkRow: { gap: 8 },
  networkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 48,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: radius.pill,
  },
  checkText: { flex: 1 },
});
