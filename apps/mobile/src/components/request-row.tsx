import { networkName } from "@pomi/shared";
import { StyleSheet, View } from "react-native";
import { type ReceiverRequest } from "@/lib/api";
import { formatAmount, formatWhen } from "@/lib/format";
import { usePalette } from "@/theme/theme";
import { AssetMark } from "./asset-logo";
import { PressableScale } from "./pressable-scale";
import { Text, type TextTone } from "./text";

export function requestTitle(request: ReceiverRequest): string {
  return request.note ?? (request.kind === "REUSABLE" ? "Reusable request" : "Request");
}

// What a row says under its title: the state in words, then when.
export function requestState(request: ReceiverRequest): { text: string; tone: TextTone } {
  const paidCount = request.payments.length;
  const lastPayment = request.payments.at(-1);
  if (request.kind === "REUSABLE") {
    if (request.status === "CLOSED") {
      return { text: `Closed · paid ${timesLabel(paidCount)}`, tone: "secondary" };
    }
    return paidCount === 0
      ? { text: `Open · sent ${formatWhen(request.createdAt)}`, tone: "reusable" }
      : { text: `Reusable · paid ${timesLabel(paidCount)}`, tone: "reusable" };
  }
  switch (request.status) {
    case "PAID":
      return {
        text: `Paid · ${formatWhen(lastPayment?.creditedAt ?? request.createdAt)}`,
        tone: "paid",
      };
    case "CLOSED":
      return { text: `Closed · ${formatWhen(request.createdAt)}`, tone: "secondary" };
    case "OPEN":
      return { text: `Waiting · sent ${formatWhen(request.createdAt)}`, tone: "waiting" };
  }
}

export function timesLabel(count: number): string {
  return count === 1 ? "once" : `${String(count)} times`;
}

export function RequestRow({
  request,
  onPress,
}: {
  request: ReceiverRequest;
  onPress: () => void;
}) {
  const palette = usePalette();
  const state = requestState(request);
  const amount = request.amount === null ? "Any" : formatAmount(request.amount);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${requestTitle(request)}, ${amount} ${request.assetSymbol} on ${networkName(request.assetNetwork)}, ${state.text}`}
      onPress={onPress}
      pressedScale={0.985}
      style={styles.row}
    >
      <AssetMark
        symbol={request.assetSymbol}
        network={request.assetNetwork}
        size={42}
        ringColor={palette.surface}
      />
      <View style={styles.middle}>
        <Text variant="headline" numberOfLines={1}>
          {requestTitle(request)}
        </Text>
        <Text variant="footnote" tone={state.tone} numberOfLines={1} style={styles.state}>
          {state.text}
        </Text>
      </View>
      <View style={styles.end}>
        <Text variant="figure" tone={request.status === "CLOSED" ? "secondary" : "primary"}>
          {amount}
        </Text>
        <Text variant="caption" tone="tertiary">
          {request.assetSymbol}
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
  state: { fontWeight: "600" },
  end: { alignItems: "flex-end", gap: 2 },
});
