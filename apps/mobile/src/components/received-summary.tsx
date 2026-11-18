import { StyleSheet, View } from "react-native";
import { sumAmounts } from "@pomi/shared";
import { type ReceiverRequest } from "@/lib/api";
import { radius } from "@/theme/theme";
import { AssetLogo } from "./asset-logo";
import { receivedPayments } from "./payment-row";
import { Text } from "./text";
import { VibrantSurface } from "./vibrant-surface";

// At most this many assets get a line; the rest are counted.
const SHOWN_ASSETS = 3;

// What reached the receiver this calendar month, one line per asset (amounts
// in different assets are never added together), on Activity's one vibrant
// card.
export function ReceivedSummary({
  requests,
  now = new Date(),
}: {
  requests: ReceiverRequest[];
  now?: Date;
}) {
  const payments = receivedPayments(requests).filter((payment) => {
    const credited = new Date(payment.creditedAt);
    return credited.getFullYear() === now.getFullYear() && credited.getMonth() === now.getMonth();
  });
  const bySymbol = new Map<string, string[]>();
  for (const payment of payments) {
    const symbol = payment.request.assetSymbol;
    bySymbol.set(symbol, [...(bySymbol.get(symbol) ?? []), payment.amount]);
  }
  const totals = [...bySymbol.entries()].map(([symbol, amounts]) => ({
    symbol,
    total: sumAmounts(amounts),
  }));
  const waiting = requests.filter((request) => request.status === "OPEN").length;
  const month = now.toLocaleDateString(undefined, { month: "long" });

  return (
    <VibrantSurface radius={radius.card} style={styles.card}>
      <View accessibilityRole="summary" style={styles.content}>
        <Text variant="label" style={styles.soft}>
          Paid to you in {month}
        </Text>
        {totals.length === 0 ? (
          <Text variant="title" style={styles.white}>
            Nothing yet
          </Text>
        ) : (
          <View style={styles.totals}>
            {totals.slice(0, SHOWN_ASSETS).map(({ symbol, total }) => (
              <View key={symbol} style={styles.total}>
                <AssetLogo symbol={symbol} size={26} />
                <Text
                  variant="title"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.shrink, styles.white]}
                >
                  {total}
                </Text>
                <Text variant="headline" style={styles.soft}>
                  {symbol}
                </Text>
              </View>
            ))}
            {totals.length > SHOWN_ASSETS && (
              <Text variant="footnote" style={styles.soft}>
                and {String(totals.length - SHOWN_ASSETS)} more
              </Text>
            )}
          </View>
        )}
        <Text variant="footnote" style={styles.soft}>
          {payments.length === 1 ? "1 payment" : `${String(payments.length)} payments`}
          {" · "}
          {waiting === 1 ? "1 request waiting" : `${String(waiting)} requests waiting`}
        </Text>
      </View>
    </VibrantSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18 },
  content: { gap: 10 },
  white: { color: "#FFFFFF" },
  soft: { color: "rgba(255, 255, 255, 0.86)" },
  totals: { gap: 6 },
  total: { flexDirection: "row", alignItems: "center", gap: 10 },
  shrink: { flexShrink: 1 },
});
