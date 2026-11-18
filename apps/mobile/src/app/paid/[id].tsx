import { networkName } from "@pomi/shared";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { AssetMark } from "@/components/asset-logo";
import { Button, IconButton } from "@/components/button";
import { Illustration } from "@/components/illustration";
import { requestTitle } from "@/components/request-row";
import { Screen, ScreenHeader } from "@/components/screen";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { assetsSchema, requestsSchema } from "@/lib/api";
import { transactionUrl } from "@/lib/config";
import { formatAmount, formatDateTime } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { useReduceMotion } from "@/lib/reduce-motion";
import { useApi } from "@/lib/use-api";
import { BRAND_SCREEN_GRADIENT } from "@/theme/palette";
import { radius, usePalette } from "@/theme/theme";

// "You were paid": where a payment notification leads, painted in the brand
// colors like the payment moments of the big money apps. Only what Pomi has
// recorded as credited is shown here, never what a payer claims.
export default function PaidScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requests = useApi("/api/requests", requestsSchema);
  const assets = useApi("/api/assets", assetsSchema);
  const request = requests.data?.requests.find((candidate) => candidate.id === id);
  const payment = request?.payments.at(-1);
  // Only a Stellar settlement is known to be a Stellar transaction, so only
  // it links to a Stellar explorer.
  const network = request?.assetNetwork === "stellar" ? assets.data?.network : undefined;
  const hash = payment?.settlementTransactionHash ?? null;

  useEffect(() => {
    if (payment !== undefined) {
      haptics.success();
    }
  }, [payment]);

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home");
    }
  }

  return (
    <Screen
      backgroundStyle={styles.brandScreen}
      footer={
        <>
          <Button title="Done" variant="inverse" onPress={close} />
          {hash !== null && network !== undefined && (
            <Button
              title="See it on Stellar Expert"
              variant="ghost"
              size="medium"
              icon="external"
              onPress={() => void WebBrowser.openBrowserAsync(transactionUrl(network, hash))}
            />
          )}
        </>
      }
    >
      <StatusBar style="light" />
      <ScreenHeader
        trailing={<IconButton icon="close" label="Close" tone="onDark" onPress={close} />}
      />
      {request === undefined || payment === undefined ? (
        <View style={styles.center}>
          {requests.data === null ? (
            <Skeleton style={styles.lineSkeleton} />
          ) : (
            <Text variant="body" style={[styles.centerText, styles.white]}>
              This payment is still on its way. It shows here once it lands.
            </Text>
          )}
        </View>
      ) : (
        <>
          <View style={styles.center}>
            <Arrival />
            <View style={styles.words}>
              <Text variant="headline" style={styles.white}>
                You were paid
              </Text>
              <View style={styles.amountRow}>
                <Text
                  variant="hero"
                  accessibilityRole="header"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.white, styles.amount]}
                >
                  {formatAmount(payment.amount)}
                </Text>
                <Text variant="title" style={styles.whiteSoft}>
                  {request.assetSymbol}
                </Text>
              </View>
              <Text variant="body" style={[styles.centerText, styles.whiteSoft]}>
                for {requestTitle(request)}
              </Text>
            </View>
          </View>
          <Details
            assetSymbol={request.assetSymbol}
            assetNetwork={request.assetNetwork}
            when={formatDateTime(payment.creditedAt)}
            status={
              request.kind === "REUSABLE"
                ? `Open, paid ${String(request.payments.length)}×`
                : request.status === "PAID"
                  ? "Closed, paid once"
                  : "Open"
            }
          />
        </>
      )}
    </Screen>
  );
}

// The 3D tick springs in once, unless the system asks for less motion.
function Arrival() {
  const reduceMotion = useReduceMotion();
  const grow = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (reduceMotion) {
      grow.setValue(1);
      return;
    }
    Animated.spring(grow, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 12 }).start();
  }, [grow, reduceMotion]);
  return (
    <Animated.View style={[styles.arrival, { transform: [{ scale: grow }] }]}>
      <Illustration name="tick" size={128} />
    </Animated.View>
  );
}

function Details({
  assetSymbol,
  assetNetwork,
  when,
  status,
}: {
  assetSymbol: string;
  assetNetwork: string;
  when: string;
  status: string;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.details, { backgroundColor: palette.surface }]}>
      <View style={styles.detail}>
        <Text variant="callout" tone="secondary">
          Landed in
        </Text>
        <View style={styles.landed}>
          <AssetMark
            symbol={assetSymbol}
            network={assetNetwork}
            size={24}
            ringColor={palette.surface}
          />
          <Text variant="callout" style={styles.detailValue}>
            Your {networkName(assetNetwork)} wallet
          </Text>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: palette.line }]} />
      <View style={styles.detail}>
        <Text variant="callout" tone="secondary">
          When
        </Text>
        <Text variant="callout" style={styles.detailValue}>
          {when}
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: palette.line }]} />
      <View style={styles.detail}>
        <Text variant="callout" tone="secondary">
          Request
        </Text>
        <Text variant="callout" style={styles.detailValue}>
          {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandScreen: { backgroundImage: BRAND_SCREEN_GRADIENT },
  center: { alignItems: "center", gap: 18, paddingTop: 8 },
  lineSkeleton: { width: 200, height: 60 },
  arrival: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  words: { alignItems: "center", gap: 4, alignSelf: "stretch" },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 10, maxWidth: "100%" },
  amount: { flexShrink: 1 },
  white: { color: "#FFFFFF" },
  whiteSoft: { color: "rgba(255, 255, 255, 0.88)" },
  centerText: { textAlign: "center" },
  details: {
    borderRadius: radius.row,
    paddingHorizontal: 16,
    boxShadow: "0 18px 36px -18px rgba(20, 10, 40, 0.45)",
  },
  detail: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  landed: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailValue: { fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth },
});
