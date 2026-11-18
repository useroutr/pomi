import { networkName } from "@pomi/shared";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { NetworkLogo } from "@/components/asset-logo";
import { Group, GroupRow } from "@/components/group";
import { Icon } from "@/components/icon";
import { PressableScale } from "@/components/pressable-scale";
import { TabScreen } from "@/components/screen";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { VibrantSurface } from "@/components/vibrant-surface";
import { addressFormat } from "@/lib/address-format";
import { assetsSchema, meSchema, payBoxSchema, payoutAddressesSchema } from "@/lib/api";
import { APP_URL, displayLink, pageLink } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import {
  enableNotifications,
  type NotificationPermission,
  notificationPermission,
} from "@/lib/push";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import { useCopied } from "@/lib/use-copied";
import { BRAND_VIOLET } from "@/theme/palette";
import { radius } from "@/theme/theme";

// Tile colors for the settings rows: the brand's own, plus the green and
// blue system settings use for money and mail.
const TINTS = {
  violet: BRAND_VIOLET,
  pink: "#D6246E",
  orange: "#E8590C",
  green: "#12854A",
  blue: "#2563EB",
  grey: "#6B6578",
} as const;

const USEROUTR_URL = "https://www.useroutr.com";

export default function YouScreen() {
  const { api, signOut } = useSession();
  const { copied, copy } = useCopied();
  const me = useApi("/api/me", meSchema);
  const payout = useApi("/api/me/payout-addresses", payoutAddressesSchema);
  const assets = useApi("/api/assets", assetsSchema);
  const payBox = useApi("/api/me/pay-box", payBoxSchema);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useFocusEffect(
    useCallback(() => {
      void notificationPermission().then(setPermission);
    }, []),
  );

  const user = me.data?.user;
  const saved = payout.data?.payoutAddresses;
  const box = payBox.data?.payBox;
  // Each network a request can pay a receiver on, with what it pays in.
  const payoutNetworks = new Map<string, string[]>();
  for (const asset of assets.data?.assets ?? []) {
    payoutNetworks.set(asset.network, [...(payoutNetworks.get(asset.network) ?? []), asset.symbol]);
  }
  const name = user?.displayName ?? user?.handle ?? "You";

  function confirmSignOut() {
    Alert.alert(
      "Sign out of Pomi?",
      "Your requests stay as they are. Sign in again with your email.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void signOut() },
      ],
    );
  }

  return (
    <TabScreen
      refreshing={me.refreshing}
      onRefresh={() => {
        void me.reload();
        void payout.reload();
        void assets.reload();
        void payBox.reload();
      }}
    >
      <VibrantSurface radius={radius.card} style={styles.profile}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text variant="title" style={styles.initial}>
              {(user?.displayName?.trim()[0] ?? user?.handle?.[0] ?? "P").toUpperCase()}
            </Text>
          </View>
        </View>
        {user === undefined ? (
          <Skeleton style={styles.nameSkeleton} />
        ) : (
          <Text variant="title2" accessibilityRole="header" numberOfLines={1} style={styles.white}>
            {name}
          </Text>
        )}
        {user?.handle !== null && user?.handle !== undefined && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Copy ${displayLink(pageLink(user.handle))}`}
            onPress={() => {
              if (user.handle !== null) {
                copy(pageLink(user.handle));
              }
            }}
            style={styles.linkPill}
          >
            <Text variant="callout" style={[styles.linkText, styles.white]}>
              {displayLink(pageLink(user.handle))}
            </Text>
            <Icon name={copied ? "check" : "copy"} size={13} color="#FFFFFF" />
          </PressableScale>
        )}
      </VibrantSurface>

      <Group title="Your page" withIcons>
        <GroupRow
          icon="person"
          tint={TINTS.violet}
          label="Name payers see"
          value={user?.displayName ?? "Not set"}
          onPress={() => {
            router.push("/name");
          }}
        />
        <GroupRow
          icon="sparkle"
          tint={TINTS.orange}
          label="Pay box"
          detail="Lets anyone pay you any amount from your page"
          value={
            box === undefined
              ? undefined
              : !box?.open
                ? "Off"
                : payBoxSummary(box.amount, box.minimumAmount, box.assetSymbol)
          }
          onPress={() => {
            router.push("/pay-box");
          }}
        />
        <GroupRow
          icon="qr"
          tint={TINTS.pink}
          label="Page QR code"
          onPress={() => {
            router.push("/page-qr");
          }}
        />
      </Group>

      <Group
        title="Where you get paid"
        withIcons
        footer="Each request pays your wallet on its own network. Payers can still pay from any network."
      >
        {payoutNetworks.size === 0 ? (
          <GroupRow icon="wallet" tint={TINTS.green} label="Your wallets" />
        ) : (
          [...payoutNetworks].map(([network, symbols]) => {
            const address = saved?.find((candidate) => candidate.network === network);
            return (
              <GroupRow
                key={network}
                leading={<NetworkLogo network={network} size={30} />}
                label={networkName(network)}
                detail={symbols.join(" and ")}
                value={
                  saved === undefined
                    ? undefined
                    : address === undefined
                      ? "Add"
                      : addressFormat(network).shorten(address.address)
                }
                onPress={() => {
                  router.push({ pathname: "/payout", params: { network } });
                }}
              />
            );
          })
        )}
      </Group>

      <Group title="Getting paid" withIcons>
        <GroupRow
          icon="link"
          tint={TINTS.violet}
          label="Ways to pay you"
          detail="The networks and tokens payers can use"
          onPress={() => {
            router.push("/pay-with");
          }}
        />
        <GroupRow
          icon="bell"
          tint={TINTS.orange}
          label="Payment notifications"
          value={
            permission === "granted" ? "On" : permission === "denied" ? "Off in Settings" : "Off"
          }
          onPress={() => {
            if (permission === "undetermined") {
              void enableNotifications(api).then(() =>
                notificationPermission().then(setPermission),
              );
            } else {
              void Linking.openSettings();
            }
          }}
        />
      </Group>

      <Group title="Account" withIcons>
        <GroupRow icon="mail" tint={TINTS.blue} label="Email" value={user?.email} />
        <GroupRow
          icon="signOut"
          tint={TINTS.grey}
          label="Sign out"
          tone="danger"
          onPress={confirmSignOut}
        />
      </Group>

      <Group
        title="About"
        withIcons
        footer="Pomi never holds your money. Payments are processed by Useroutr and land in your own wallet."
      >
        <GroupRow
          icon="globe"
          tint={TINTS.pink}
          label="Pomi on the web"
          value={displayLink(APP_URL)}
          onPress={() => void WebBrowser.openBrowserAsync(APP_URL)}
        />
        <GroupRow
          icon="lock"
          tint={TINTS.violet}
          label="Payments by Useroutr"
          value="useroutr.com"
          onPress={() => void WebBrowser.openBrowserAsync(USEROUTR_URL)}
        />
      </Group>
    </TabScreen>
  );
}

function payBoxSummary(amount: string | null, minimum: string | null, symbol: string): string {
  if (amount !== null) {
    return `${formatAmount(amount)} ${symbol}`;
  }
  return minimum === null ? `Any amount, ${symbol}` : `From ${formatAmount(minimum)} ${symbol}`;
}

const styles = StyleSheet.create({
  profile: {
    alignItems: "center",
    gap: 8,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 18,
  },
  // A frosted ring around the initial, as the card's glass edge is.
  avatarRing: {
    padding: 3,
    borderRadius: 48,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    marginBottom: 4,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  white: { color: "#FFFFFF" },
  initial: { color: BRAND_VIOLET },
  nameSkeleton: { width: 140, height: 28 },
  linkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.45)",
  },
  linkText: { fontWeight: "600" },
});
