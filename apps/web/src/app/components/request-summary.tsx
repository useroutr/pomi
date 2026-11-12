import { shortenStellarAccount } from "@pomi/shared";
import { type PayerRequest } from "@/server/requests/request-service";

// What a payer sees before paying: who asks, how much, and where it goes.
export function RequestSummary({ request }: { request: PayerRequest }) {
  return (
    <section className="card">
      <p className="muted">{request.receiverName ?? "Someone"} asks for</p>
      <p className="pay-amount">
        {request.amount ?? "Any amount"} <span>{request.assetSymbol}</span>
      </p>
      {request.amount === null && request.minimumAmount !== null && (
        <p className="muted small">
          At least {request.minimumAmount} {request.assetSymbol}
        </p>
      )}
      {/* Plain text, never linked: a note is the receiver's words, and a
          link in it could pass for Pomi's own. */}
      {request.note !== null && <p className="note">{request.note}</p>}
      <p className="muted small">
        Paid on Stellar to {shortenStellarAccount(request.payoutAddress)}
        {request.payoutAddressVerified
          ? ", a verified address"
          : ", an address the receiver pasted"}
        {request.kind === "REUSABLE" && ". This link can be paid more than once"}.
      </p>
    </section>
  );
}

// Why a request takes no payment, or null when it does.
export function closedReason(request: PayerRequest): string | null {
  if (request.status === "PAID") {
    return "This request has been paid.";
  }
  if (request.status === "CLOSED") {
    return "The receiver closed this request.";
  }
  if (request.ended) {
    return "This request has ended.";
  }
  return null;
}
