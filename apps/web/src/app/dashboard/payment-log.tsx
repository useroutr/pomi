import { formatAmount } from "@pomi/shared";
import { TokenMark } from "@/app/components/token-mark";
import ui from "@/app/components/ui.module.css";
import { type ReceivedPayment } from "@/server/activity/activity-service";
import { type StellarNetwork } from "@/server/config";
import { stellarExpertTransactionUrl } from "@/server/notifications/payment-email";
import styles from "./dashboard.module.css";

// Rows shown before "Show more".
const FIRST_ROWS = 6;

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

// What a payment paid: the pay box, or a request named by its note.
function source(payment: ReceivedPayment): string {
  if (payment.payBox) {
    return "Pay box";
  }
  return payment.note ?? "A request";
}

function PaymentItem({ payment, network }: { payment: ReceivedPayment; network: StellarNetwork }) {
  return (
    <li className={styles.payment}>
      <TokenMark symbol={payment.assetSymbol} network={payment.assetNetwork} size={36} />
      <div className={styles.paymentText}>
        <strong>
          +{formatAmount(payment.amount)} {payment.assetSymbol}
        </strong>
        <span>
          {source(payment)} · {dateFormat.format(payment.creditedAt)} UTC
        </span>
      </div>
      {/* Only a Stellar settlement is known to be a Stellar transaction, so
          only it links to a Stellar explorer. */}
      {payment.settlementTransactionHash !== null && payment.assetNetwork === "stellar" && (
        <a
          className={styles.paymentLink}
          href={stellarExpertTransactionUrl(network, payment.settlementTransactionHash)}
          target="_blank"
          rel="noreferrer"
        >
          View on Stellar
        </a>
      )}
    </li>
  );
}

// Every payment that reached the receiver, the pay box's included, newest
// first.
export function PaymentLog({
  payments,
  paymentsInAll,
  network,
}: {
  payments: ReceivedPayment[];
  paymentsInAll: number;
  network: StellarNetwork;
}) {
  if (payments.length === 0) {
    return (
      <div className={styles.empty}>
        <strong>No payments yet</strong>
        <p>When someone pays a request or your pay box, it shows up here.</p>
      </div>
    );
  }
  const rest = payments.slice(FIRST_ROWS);
  return (
    <>
      <ul className={styles.paymentList}>
        {payments.slice(0, FIRST_ROWS).map((payment) => (
          <PaymentItem key={payment.id} payment={payment} network={network} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className={styles.more}>
          <summary className={[ui.secondaryButton, ui.compact].join(" ")}>
            Show {rest.length} more
          </summary>
          <ul className={styles.paymentList}>
            {rest.map((payment) => (
              <PaymentItem key={payment.id} payment={payment} network={network} />
            ))}
          </ul>
        </details>
      )}
      {paymentsInAll > payments.length && (
        <p className={ui.hint}>
          The latest {payments.length} of {paymentsInAll} payments.
        </p>
      )}
    </>
  );
}
