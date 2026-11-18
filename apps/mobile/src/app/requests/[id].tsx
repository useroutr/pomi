import { formatAmount, networkName, sumAmounts } from "@pomi/shared";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActionSheetIOS, Alert, Platform, Share, StyleSheet, View } from "react-native";
import { AssetMark, NetworkStack } from "@/components/asset-logo";
import { IconButton } from "@/components/button";
import { Icon } from "@/components/icon";
import { ListCard } from "@/components/list-card";
import { PressableScale } from "@/components/pressable-scale";
import { requestTitle, timesLabel } from "@/components/request-row";
import { RoundAction } from "@/components/round-action";
import { Screen, ScreenHeader } from "@/components/screen";
import { ShareCard } from "@/components/share-card";
import { Skeleton } from "@/components/skeleton";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { assetsSchema, type PaymentNetwork, type ReceiverRequest, requestsSchema } from "@/lib/api";
import { requestLink, transactionUrl } from "@/lib/config";
import { formatWhen } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { networkList } from "@/lib/networks";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import { useCopied } from "@/lib/use-copied";
import { CARD_SHADOW, radius, usePalette } from "@/theme/theme";

export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const palette = usePalette();
  const requests = useApi("/api/requests", requestsSchema);
  const assets = useApi("/api/assets", assetsSchema);
  const [showQr, setShowQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopied();
  const request = requests.data?.requests.find((candidate) => candidate.id === id);

  async function setListed(listed: boolean) {
    const result = await api.patch(`/api/requests/${encodeURIComponent(id)}`, { listed });
    if (result.ok) {
      haptics.success();
      await requests.reload();
    } else {
      setError(result.message);
    }
  }

  async function close() {
    const result = await api.postNoContent(`/api/requests/${encodeURIComponent(id)}/close`, {});
    if (result.ok) {
      haptics.success();
      await requests.reload();
    } else {
      setError(result.message);
    }
  }

  function confirmClose() {
    Alert.alert(
      "Close this request?",
      "Its link stops taking payments. Payments already made stay yours.",
      [
        { text: "Keep it open", style: "cancel" },
        { text: "Close request", style: "destructive", onPress: () => void close() },
      ],
    );
  }

  function openMenu(current: ReceiverRequest) {
    const listLabel = current.listed ? "Hide from my page" : "Show on my page";
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [listLabel, "Close request", "Cancel"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) {
            void setListed(!current.listed);
          } else if (index === 1) {
            confirmClose();
          }
        },
      );
    } else {
      Alert.alert(requestTitle(current), undefined, [
        { text: listLabel, onPress: () => void setListed(!current.listed) },
        { text: "Close request", style: "destructive", onPress: confirmClose },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  const link = requestLink(id);

  return (
    <Screen>
      <ScreenHeader
        leading={
          <IconButton
            icon="back"
            label="Back"
            onPress={() => {
              router.back();
            }}
          />
        }
        trailing={
          request?.status === "OPEN" ? (
            <IconButton
              icon="more"
              label="More actions"
              onPress={() => {
                openMenu(request);
              }}
            />
          ) : undefined
        }
      />

      {request === undefined ? (
        requests.data === null ? (
          <View style={styles.loading}>
            <Skeleton style={styles.heroSkeleton} />
            <Skeleton style={styles.lineSkeleton} />
          </View>
        ) : (
          <Text variant="body" tone="secondary">
            This request isn't one of yours, or it no longer exists.
          </Text>
        )
      ) : (
        <>
          <View
            style={[styles.hero, { backgroundColor: palette.surface, borderColor: palette.line }]}
          >
            <View style={styles.heroTop}>
              <AssetMark
                symbol={request.assetSymbol}
                network={request.assetNetwork}
                size={48}
                ringColor={palette.surface}
              />
              <View style={styles.pills}>
                <StatusPill {...statusPill(request)} />
                {request.kind === "REUSABLE" && <StatusPill kind="reusable" label="Reusable" />}
                {request.listed && <StatusPill kind="listed" label="On your page" />}
              </View>
            </View>
            <View>
              <View style={styles.amountRow}>
                <Text variant="amount" accessibilityRole="header">
                  {request.amount === null ? "Any amount" : formatAmount(request.amount)}
                </Text>
                <Text variant="section" tone="secondary">
                  {request.assetSymbol}
                </Text>
              </View>
              <Text variant="body" tone="secondary">
                {requestTitle(request)}
              </Text>
              <Text variant="footnote" tone="tertiary">
                Paid to your {networkName(request.assetNetwork)} wallet
              </Text>
            </View>
            {request.status === "OPEN" && (
              <View style={styles.actions}>
                <RoundAction
                  icon="share"
                  label="Share"
                  onPress={() => {
                    haptics.tap();
                    void Share.share({ message: link, url: link });
                  }}
                />
                <RoundAction
                  icon="qr"
                  label={showQr ? "Hide QR" : "QR code"}
                  onPress={() => {
                    haptics.select();
                    setShowQr(!showQr);
                  }}
                />
                <RoundAction
                  icon={copied ? "check" : "copy"}
                  label={copied ? "Copied" : "Copy link"}
                  onPress={() => {
                    copy(link);
                  }}
                />
                <RoundAction
                  icon="external"
                  label="Pay page"
                  onPress={() => void WebBrowser.openBrowserAsync(link)}
                />
              </View>
            )}
          </View>
          {request.status === "OPEN" && showQr && (
            <ShareCard
              link={link}
              title={`${request.amount === null ? "Any amount" : formatAmount(request.amount)} ${request.assetSymbol}`}
            />
          )}

          <Payments
            request={request}
            network={assets.data?.network ?? null}
            payWith={assets.data?.payWith ?? []}
          />
          {error !== null && (
            <Text variant="callout" tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}

function statusPill(request: ReceiverRequest): {
  kind: "paid" | "waiting" | "closed";
  label: string;
} {
  if (request.status === "PAID") {
    return { kind: "paid", label: "Paid" };
  }
  if (request.status === "CLOSED") {
    return { kind: "closed", label: "Closed" };
  }
  return { kind: "waiting", label: request.kind === "REUSABLE" ? "Open" : "Waiting" };
}

function Payments({
  request,
  network,
  payWith,
}: {
  request: ReceiverRequest;
  network: "testnet" | "mainnet" | null;
  payWith: PaymentNetwork[];
}) {
  const palette = usePalette();
  const payments = [...request.payments].reverse();
  const networks = payWith.map((entry) => entry.network);
  // Only a Stellar settlement is known to be a Stellar transaction, so only
  // it links to a Stellar explorer.
  const explorer = request.assetNetwork === "stellar" ? network : null;
  if (payments.length === 0) {
    return request.status === "OPEN" ? (
      <PressableScale
        accessibilityRole="button"
        accessibilityHint="Shows every network and token payers can use"
        onPress={() => {
          router.push("/pay-with");
        }}
        style={[styles.waiting, { backgroundColor: palette.surface, borderColor: palette.line }]}
      >
        <View style={styles.waitingTop}>
          <Text variant="headline">Waiting for the first payment</Text>
          <Icon name="chevronRight" size={14} color={palette.textTertiary} />
        </View>
        {networks.length > 0 && (
          <View style={styles.waitingNetworks}>
            <NetworkStack networks={networks.slice(0, 4)} size={26} ringColor={palette.surface} />
            <Text variant="footnote" tone="secondary" style={styles.grow}>
              Payers can pay from {networkList(networks)}. You get {request.assetSymbol} on{" "}
              {networkName(request.assetNetwork)}.
            </Text>
          </View>
        )}
      </PressableScale>
    ) : null;
  }
  return (
    <View style={styles.payments}>
      <View style={styles.paymentsTitle}>
        <Text variant="section" accessibilityRole="header">
          Paid {timesLabel(payments.length)}
        </Text>
        {payments.length > 1 && (
          <Text variant="callout" tone="secondary">
            {sumAmounts(payments.map((payment) => payment.amount))} {request.assetSymbol} in all
          </Text>
        )}
      </View>
      <ListCard>
        {payments.map((payment) => {
          const hash = payment.settlementTransactionHash;
          const row = (
            <View style={styles.paymentRow}>
              <AssetMark
                symbol={request.assetSymbol}
                network={request.assetNetwork}
                size={40}
                ringColor={palette.surface}
              />
              <View style={styles.grow}>
                <Text variant="headline">Payment received</Text>
                <Text variant="footnote" tone="secondary">
                  {formatWhen(payment.creditedAt)}
                </Text>
              </View>
              <Text variant="figure" tone="paid">
                +{formatAmount(payment.amount)}
              </Text>
              {hash !== null && explorer !== null && (
                <Icon name="external" size={13} color={palette.textTertiary} />
              )}
            </View>
          );
          return hash !== null && explorer !== null ? (
            <PressableScale
              key={payment.creditedAt}
              accessibilityRole="link"
              accessibilityHint="Shows this payment on Stellar Expert"
              pressedScale={0.985}
              onPress={() => void WebBrowser.openBrowserAsync(transactionUrl(explorer, hash))}
            >
              {row}
            </PressableScale>
          ) : (
            <View key={payment.creditedAt}>{row}</View>
          );
        })}
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { gap: 12 },
  heroSkeleton: { height: 120, borderRadius: radius.card },
  lineSkeleton: { height: 56 },
  hero: {
    gap: 18,
    padding: 18,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: CARD_SHADOW,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  pills: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", flex: 1 },
  actions: { flexDirection: "row", justifyContent: "space-between" },
  grow: { flex: 1 },
  waiting: {
    gap: 12,
    padding: 16,
    borderRadius: radius.row,
    borderWidth: StyleSheet.hairlineWidth,
  },
  waitingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  waitingNetworks: { flexDirection: "row", alignItems: "center", gap: 12 },
  payments: { gap: 10 },
  paymentsTitle: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  paymentRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
