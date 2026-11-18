import { sumAmounts } from "@pomi/shared";
import { TokenMark } from "@/app/components/token-mark";
import ui from "@/app/components/ui.module.css";
import { type ReceiverRequest } from "@/server/requests/request-service";
import styles from "./dashboard.module.css";

// At most this many assets get a line; the rest are counted.
const SHOWN_ASSETS = 3;

const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

// What reached the receiver this calendar month (UTC, as every date on the
// dashboard), one line per asset and network: amounts in different assets are
// never added together.
export function PaidSummary({
  requests,
  now = new Date(),
}: {
  requests: ReceiverRequest[];
  now?: Date;
}) {
  const totals = new Map<string, { symbol: string; network: string; amounts: string[] }>();
  let paymentCount = 0;
  for (const request of requests) {
    for (const payment of request.payments) {
      const credited = payment.creditedAt;
      if (
        credited.getUTCFullYear() !== now.getUTCFullYear() ||
        credited.getUTCMonth() !== now.getUTCMonth()
      ) {
        continue;
      }
      paymentCount += 1;
      // USDC on Stellar and USDC on Base are kept apart, as a wallet would.
      const key = `${request.assetSymbol}:${request.assetNetwork}`;
      const entry = totals.get(key) ?? {
        symbol: request.assetSymbol,
        network: request.assetNetwork,
        amounts: [],
      };
      entry.amounts.push(payment.amount);
      totals.set(key, entry);
    }
  }
  const lines = [...totals.values()];
  const waiting = requests.filter((request) => request.status === "OPEN").length;

  return (
    <section className={[ui.card, styles.summary].join(" ")} aria-labelledby="paid-title">
      <span id="paid-title" className={styles.summaryLabel}>
        Paid to you in {monthName.format(now)}
      </span>
      {lines.length === 0 ? (
        <p className={styles.nothing}>Nothing yet</p>
      ) : (
        <ul className={styles.totals}>
          {lines.slice(0, SHOWN_ASSETS).map((line) => (
            <li key={`${line.symbol}:${line.network}`}>
              <TokenMark symbol={line.symbol} network={line.network} size={28} />
              <span className={styles.totalAmount}>{sumAmounts(line.amounts)}</span>
              <span className={styles.totalSymbol}>{line.symbol}</span>
            </li>
          ))}
          {lines.length > SHOWN_ASSETS && (
            <li className={styles.summaryMeta}>and {lines.length - SHOWN_ASSETS} more</li>
          )}
        </ul>
      )}
      <p className={styles.summaryMeta}>
        {paymentCount === 1 ? "1 payment" : `${String(paymentCount)} payments`}
        {" · "}
        {waiting === 1 ? "1 request waiting" : `${String(waiting)} requests waiting`}
      </p>
    </section>
  );
}
