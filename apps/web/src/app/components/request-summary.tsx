import { formatAmount, networkName, shortenAddress } from "@pomi/shared";
// A type-only import: the pay panel, which runs in the browser, imports this
// file, and the request service must never reach the browser.
import type { PayerRequest } from "@/server/requests/request-service";
import { Avatar } from "./avatar";
import { CheckIcon, LockIcon } from "./icons";
import pay from "./pay.module.css";
import { TokenMark } from "./token-mark";
import ui from "./ui.module.css";

// Who is asking, at the top of a pay card.
export function ReceiverLine({ name, handle }: { name: string; handle: string | null }) {
  return (
    <div className={pay.who}>
      <Avatar name={name} size={44} />
      <div className={pay.whoText}>
        <p className={pay.whoName}>{name}</p>
        {handle !== null && <span className={pay.whoSub}>@{handle}</span>}
      </div>
    </div>
  );
}

// The amount a request asks for, when it is fixed and nothing can be typed.
export function AmountShown({
  label,
  amount,
  assetSymbol,
}: {
  label: string;
  amount: string;
  assetSymbol: string;
}) {
  return (
    <div className={pay.amountBox}>
      <span className={pay.amountLabel}>{label}</span>
      <p className={pay.amount}>
        {formatAmount(amount)} <span className={pay.amountSymbol}>{assetSymbol}</span>
      </p>
    </div>
  );
}

export function AssetLine({
  assetSymbol,
  assetNetwork,
  payable = true,
}: {
  assetSymbol: string;
  assetNetwork: string;
  // False once a request takes no payment, when how to pay no longer matters.
  payable?: boolean;
}) {
  return (
    <div className={pay.assetRow}>
      <TokenMark symbol={assetSymbol} network={assetNetwork} size={40} />
      <div className={pay.assetText}>
        <strong>{assetSymbol}</strong>
        <span>on {networkName(assetNetwork)}</span>
      </div>
      {payable && <span className={[ui.chip, pay.assetEnd].join(" ")}>Pay with any token</span>}
    </div>
  );
}

// What a payer reads before paying: what it is for and where it goes.
export function RequestDetails({ request }: { request: PayerRequest }) {
  return (
    <>
      {/* Plain text, never linked: a note is the receiver's words, and a
          link in it could pass for Pomi's own. */}
      {request.note !== null && <p className={pay.note}>{request.note}</p>}
      <dl className={pay.details}>
        <div className={pay.detailRow}>
          <dt>Paid to</dt>
          <dd>
            <span className={pay.address}>
              {shortenAddress(request.assetNetwork, request.payoutAddress)}
            </span>
            {/* Verified means the receiver signed with this wallet; a pasted
                address works but is shown as unverified. */}
            {request.payoutAddressVerified ? (
              <span className={ui.chipPaid}>Verified</span>
            ) : (
              <span className={ui.chip}>Unverified</span>
            )}
          </dd>
        </div>
        {request.kind === "REUSABLE" && (
          <div className={pay.detailRow}>
            <dt>This link</dt>
            <dd>Can be paid more than once</dd>
          </div>
        )}
      </dl>
    </>
  );
}

// Why a request takes no payment, as the card's last word.
export function ClosedState({ request }: { request: PayerRequest }) {
  const paid = request.status === "PAID";
  return (
    <div className={pay.state} role="status">
      <span className={paid ? pay.stateIconDone : pay.stateIcon}>
        {paid ? <CheckIcon /> : <LockIcon />}
      </span>
      <strong>{paid ? "Paid" : "Not taking payments"}</strong>
      <p>{closedReason(request)}</p>
    </div>
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

export function TrustLine() {
  return (
    <p className={ui.trustLine}>
      <LockIcon />
      Pomi never holds your money. Payments are processed by Useroutr.
    </p>
  );
}
