import { type StellarNetwork } from "@/server/config";
import { stellarExpertTransactionUrl } from "@/server/notifications/payment-email";
import { type ReceiverRequest } from "@/server/requests/request-service";
import { CloseRequestButton } from "./close-request-button";
import { CopyButton } from "./copy-button";
import { ListingButton } from "./listing-button";

const STATUS_LABELS = { OPEN: "Waiting", PAID: "Paid", CLOSED: "Closed" } as const;

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
    return <p className="muted">No requests yet.</p>;
  }
  return (
    <ul className="requests">
      {requests.map((request) => {
        const link = `${appUrl}/r/${request.id}`;
        return (
          <li key={request.id} className="request">
            <div className="request-head">
              <strong>
                {request.amount ?? "Any amount of"} {request.assetSymbol}
              </strong>
              <span className="row">
                {request.kind === "REUSABLE" && <span className="badge">Reusable</span>}
                {request.listed && <span className="badge">On your page</span>}
                <span className={`badge badge-${request.status.toLowerCase()}`}>
                  {STATUS_LABELS[request.status]}
                </span>
              </span>
            </div>
            {request.note !== null && <p className="note">{request.note}</p>}
            <p className="muted small">
              Created {formatDate(request.createdAt)}
              {request.endsAt !== null && `, ends ${formatDate(request.endsAt)}`}
            </p>
            {request.payments.map((payment) => (
              <p key={payment.creditedAt.toISOString()} className="small">
                Paid {payment.amount} {request.assetSymbol} on {formatDate(payment.creditedAt)}
                {payment.settlementTransactionHash !== null && (
                  <>
                    {" "}
                    <a
                      href={stellarExpertTransactionUrl(network, payment.settlementTransactionHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on Stellar
                    </a>
                  </>
                )}
              </p>
            ))}
            {request.status === "OPEN" && (
              <div className="row">
                <CopyButton text={link} />
                <a className="button-link" href={link} target="_blank" rel="noreferrer">
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
