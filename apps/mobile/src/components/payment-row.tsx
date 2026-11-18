import { StyleSheet, View } from "react-native";
import { type ReceiverRequest } from "@/lib/api";
import { formatAmount, formatWhen } from "@/lib/format";
import { usePalette } from "@/theme/theme";
import { networkName } from "@pomi/shared";
import { AssetMark } from "./asset-logo";
import { PressableScale } from "./pressable-scale";
import { requestTitle } from "./request-row";
import { Text } from "./text";

export interface ReceivedPayment {
  request: ReceiverRequest;
  amount: string;
  creditedAt: string;
}

// Every payment across every request, newest first.
export function receivedPayments(requests: ReceiverRequest[]): ReceivedPayment[] {
  return requests
    .flatMap((request) =>
      request.payments.map((payment) => ({
        request,
        amount: payment.amount,
        creditedAt: payment.creditedAt,
      })),
    )
    .sort((a, b) => b.creditedAt.localeCompare(a.creditedAt));
}

export function PaymentRow({
  payment,
  onPress,
}: {
  payment: ReceivedPayment;
  onPress: () => void;
}) {
  const palette = usePalette();
  const amount = formatAmount(payment.amount);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Received ${amount} ${payment.request.assetSymbol} on ${networkName(payment.request.assetNetwork)} for ${requestTitle(payment.request)}`}
      onPress={onPress}
      pressedScale={0.985}
      style={styles.row}
    >
      <AssetMark
        symbol={payment.request.assetSymbol}
        network={payment.request.assetNetwork}
        size={42}
        ringColor={palette.surface}
      />
      <View style={styles.middle}>
        <Text variant="headline" numberOfLines={1}>
          {requestTitle(payment.request)}
        </Text>
        <Text variant="footnote" tone="secondary" numberOfLines={1}>
          Paid {formatWhen(payment.creditedAt)}
        </Text>
      </View>
      <View style={styles.end}>
        <Text variant="figure" tone="paid">
          +{amount}
        </Text>
        <Text variant="caption" tone="tertiary">
          {payment.request.assetSymbol}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // A row inside a ListCard, which draws the card and the dividers.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingRight: 16,
  },
  middle: { flex: 1, gap: 2 },
  end: { alignItems: "flex-end", gap: 2 },
});
