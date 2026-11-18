import { formatAmount } from "@pomi/shared";
import { TokenMark } from "@/app/components/token-mark";
import ui from "@/app/components/ui.module.css";
import { type StellarNetwork } from "@/server/config";
import { stellarExpertTransactionUrl } from "@/server/notifications/payment-email";
import { type ReceiverRequest } from "@/server/requests/request-service";
import { CloseRequestButton } from "./close-request-button";
import { CopyButton } from "./copy-button";
import styles from "./dashboard.module.css";
import { ListingButton } from "./listing-button";

const STATUS = {
  OPEN: { label: "Waiting", chip: ui.chipWaiting },
  PAID: { label: "Paid", chip: ui.chipPaid },
  CLOSED: { label: "Closed", chip: ui.chip },
} as const;

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(date: Date): string {
  return `${dateFormat.format(date)} UTC`;
}

export function RequestList({
  requests,
  appUrl,
  network,
}: {
  requests: ReceiverRequest[];
  appUrl: string;
  network: StellarNetwork;
}) {
  if (requests.length === 0) {
    return (
      <div className={styles.empty}>
        <strong>No requests yet</strong>
        <p>Ask for an amount, then share the link it gives you. Payments show up here.</p>
      </div>
    );
  }
  return (
    <ul className={styles.requests}>
      {requests.map((request) => {
        const link = `${appUrl}/r/${request.id}`;
        const status = STATUS[request.status];
        return (
          <li key={request.id} className={styles.request}>
            <div className={styles.requestHead}>
              <TokenMark symbol={request.assetSymbol} network={request.assetNetwork} size={40} />
              <div className={styles.requestText}>
                <strong>
                  {request.amount === null
                    ? `Any amount of ${request.assetSymbol}`
                    : `${formatAmount(request.amount)} ${request.assetSymbol}`}
                </strong>
                <span>{request.note ?? "No note"}</span>
              </div>
              <div className={styles.chips}>
                {request.kind === "REUSABLE" && <span className={ui.chip}>Reusable</span>}
                {request.listed && <span className={ui.chip}>On your page</span>}
                <span className={status.chip}>{status.label}</span>
              </div>
            </div>
            <p className={styles.meta}>
              Created {formatDate(request.createdAt)}
              {request.endsAt !== null && `, ends ${formatDate(request.endsAt)}`}
            </p>
            {request.payments.length > 0 && (
              <ul className={styles.payments}>
                {request.payments.map((payment) => (
                  <li key={payment.creditedAt.toISOString()}>
                    <span className={styles.paymentAmount}>
                      +{formatAmount(payment.amount)} {request.assetSymbol}
                    </span>
                    <span>{formatDate(payment.creditedAt)}</span>
                    {/* Only a Stellar settlement is known to be a Stellar
                        transaction, so only it links to a Stellar explorer. */}
                    {payment.settlementTransactionHash !== null &&
                      request.assetNetwork === "stellar" && (
                        <a
                          href={stellarExpertTransactionUrl(
                            network,
                            payment.settlementTransactionHash,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Stellar
                        </a>
                      )}
                  </li>
                ))}
              </ul>
            )}
            {request.status === "OPEN" && (
              <div className={styles.actions}>
                <CopyButton text={link} />
                <a
                  className={[ui.ghostButton, ui.compact].join(" ")}
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
                <ListingButton requestId={request.id} listed={request.listed} />
                <CloseRequestButton requestId={request.id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
