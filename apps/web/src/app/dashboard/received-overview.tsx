import { formatAmount } from "@pomi/shared";
import { TokenMark } from "@/app/components/token-mark";
import ui from "@/app/components/ui.module.css";
import { type ReceivedActivity } from "@/server/activity/activity-service";
import styles from "./dashboard.module.css";
import { PaymentsChart } from "./payments-chart";

// At most this many assets get a line; the rest are counted.
const SHOWN_ASSETS = 3;

const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

function payments(count: number): string {
  return count === 1 ? "1 payment" : `${String(count)} payments`;
}

// What reached the receiver: this month (UTC, as every date on the
// dashboard) and in all, one line per asset and network, since amounts in
// different assets are never added together. The pay box counts too.
export function ReceivedOverview({
  activity,
  now = new Date(),
}: {
  activity: ReceivedActivity;
  now?: Date;
}) {
  const month = activity.totals.filter((total) => total.paymentsThisMonth > 0);
  const paymentsThisMonth = month.reduce((sum, total) => sum + total.paymentsThisMonth, 0);
  const paymentsInAll = activity.totals.reduce((sum, total) => sum + total.payments, 0);

  return (
    <section className={[ui.card, styles.summary].join(" ")} aria-labelledby="received-title">
      <div className={styles.sectionHead}>
        <span id="received-title" className={styles.summaryLabel}>
          Received in {monthName.format(now)}
        </span>
        <span className={ui.chip}>{payments(paymentsThisMonth)}</span>
      </div>
      {month.length === 0 ? (
        <p className={styles.nothing}>Nothing yet</p>
      ) : (
        <ul className={styles.totals}>
          {month.slice(0, SHOWN_ASSETS).map((total) => (
            <li key={`${total.assetSymbol}:${total.assetNetwork}`}>
              <TokenMark symbol={total.assetSymbol} network={total.assetNetwork} size={28} />
              <span className={styles.totalAmount}>{formatAmount(total.thisMonth)}</span>
              <span className={styles.totalSymbol}>{total.assetSymbol}</span>
            </li>
          ))}
          {month.length > SHOWN_ASSETS && (
            <li className={styles.summaryMeta}>and {month.length - SHOWN_ASSETS} more</li>
          )}
        </ul>
      )}
      {activity.totals.length > 0 && (
        <p className={styles.summaryMeta}>
          In all:{" "}
          {activity.totals
            .slice(0, SHOWN_ASSETS)
            .map((total) => `${formatAmount(total.total)} ${total.assetSymbol}`)
            .join(" · ")}
          {activity.totals.length > SHOWN_ASSETS &&
            ` and ${String(activity.totals.length - SHOWN_ASSETS)} more`}
          {`, from ${payments(paymentsInAll)}`}
        </p>
      )}
      <PaymentsChart days={activity.days} />
    </section>
  );
}
