import { StyleSheet, View } from "react-native";
import { type ReceivedPayment } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import { usePalette } from "@/theme/theme";
import { formatAmount, networkName } from "@pomi/shared";
import { AssetMark } from "./asset-logo";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

// What a payment paid: the pay box, or a request named by its note.
export function paymentTitle(payment: ReceivedPayment): string {
  if (payment.payBox) {
    return "Pay box";
  }
  return payment.note ?? "Request";
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
      accessibilityLabel={`Received ${amount} ${payment.assetSymbol} on ${networkName(payment.assetNetwork)} for ${paymentTitle(payment)}`}
      onPress={onPress}
      pressedScale={0.985}
      style={styles.row}
    >
      <AssetMark
        symbol={payment.assetSymbol}
        network={payment.assetNetwork}
        size={42}
        ringColor={palette.surface}
      />
      <View style={styles.middle}>
        <Text variant="headline" numberOfLines={1}>
          {paymentTitle(payment)}
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
          {payment.assetSymbol}
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
