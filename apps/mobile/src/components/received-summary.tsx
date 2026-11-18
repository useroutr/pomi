import { StyleSheet, View } from "react-native";
import { formatAmount } from "@pomi/shared";
import { type ReceivedActivity } from "@/lib/api";
import { radius } from "@/theme/theme";
import { AssetLogo } from "./asset-logo";
import { Text } from "./text";
import { VibrantSurface } from "./vibrant-surface";

// At most this many assets get a line; the rest are counted.
const SHOWN_ASSETS = 3;

function paymentsLabel(count: number): string {
  return count === 1 ? "1 payment" : `${String(count)} payments`;
}

// What reached the receiver this month and in all, one line per asset
// (amounts in different assets are never added together), the pay box
// included, on Activity's one vibrant card. Months are UTC, as the server
// counts them.
export function ReceivedSummary({
  activity,
  now = new Date(),
}: {
  activity: ReceivedActivity;
  now?: Date;
}) {
  const month = activity.totals.filter((total) => total.paymentsThisMonth > 0);
  const paymentsThisMonth = month.reduce((sum, total) => sum + total.paymentsThisMonth, 0);
  const paymentsInAll = activity.totals.reduce((sum, total) => sum + total.payments, 0);
  const monthName = now.toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });

  return (
    <VibrantSurface radius={radius.card} style={styles.card}>
      <View accessibilityRole="summary" style={styles.content}>
        <Text variant="label" style={styles.soft}>
          Received in {monthName}
        </Text>
        {month.length === 0 ? (
          <Text variant="title" style={styles.white}>
            Nothing yet
          </Text>
        ) : (
          <View style={styles.totals}>
            {month.slice(0, SHOWN_ASSETS).map((total) => (
              <View key={`${total.assetSymbol}:${total.assetNetwork}`} style={styles.total}>
                <AssetLogo symbol={total.assetSymbol} size={26} />
                <Text
                  variant="title"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.shrink, styles.white]}
                >
                  {formatAmount(total.thisMonth)}
                </Text>
                <Text variant="headline" style={styles.soft}>
                  {total.assetSymbol}
                </Text>
              </View>
            ))}
            {month.length > SHOWN_ASSETS && (
              <Text variant="footnote" style={styles.soft}>
                and {String(month.length - SHOWN_ASSETS)} more
              </Text>
            )}
          </View>
        )}
        <DayBars days={activity.days} />
        <Text variant="footnote" style={styles.soft}>
          {paymentsLabel(paymentsThisMonth)} this month
          {activity.totals.length > 0 &&
            ` · in all ${activity.totals
              .slice(0, SHOWN_ASSETS)
              .map((total) => `${formatAmount(total.total)} ${total.assetSymbol}`)
              .join(", ")} from ${paymentsLabel(paymentsInAll)}`}
        </Text>
      </View>
    </VibrantSurface>
  );
}

// Payments per day for the last month, today last: one white bar a day on
// the card, an empty day a faint tick.
function DayBars({ days }: { days: ReceivedActivity["days"] }) {
  const total = days.reduce((sum, day) => sum + day.payments, 0);
  const most = Math.max(1, ...days.map((day) => day.payments));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${paymentsLabel(total)} in the last ${String(days.length)} days`}
      style={styles.bars}
    >
      {days.map((day) => (
        <View key={day.date} style={styles.slot}>
          <View
            style={
              day.payments === 0
                ? styles.empty
                : [styles.bar, { height: `${String((day.payments / most) * 100)}%` }]
            }
          />
        </View>
      ))}
    </View>
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
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 40, marginTop: 4 },
  slot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: {
    minHeight: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  empty: { height: 2, borderRadius: 1, backgroundColor: "rgba(255, 255, 255, 0.35)" },
});
