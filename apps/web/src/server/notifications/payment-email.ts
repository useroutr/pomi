import { networkName, product } from "@pomi/shared";
import { type StellarNetwork } from "../config";
import { type EmailMessage } from "../email/email-delivery";

export interface PaymentEmailDetails {
  to: string;
  amount: string;
  assetSymbol: string;
  // Useroutr's network id for the asset: where the receiver was paid.
  assetNetwork: string;
  note: string | null;
  settlementTransactionHash: string | null;
  appUrl: string;
  network: StellarNetwork;
}

export function paymentEmail(details: PaymentEmailDetails): EmailMessage {
  const paid = `${details.amount} ${details.assetSymbol}`;
  const forNote = details.note === null ? "" : ` for "${details.note}"`;
  const dashboardUrl = `${details.appUrl}/dashboard`;
  const wallet = `your ${networkName(details.assetNetwork)} wallet`;
  // Only a Stellar settlement is known to be a Stellar transaction, so only
  // it links to a Stellar explorer.
  const transactionUrl =
    details.settlementTransactionHash === null || details.assetNetwork !== "stellar"
      ? null
      : stellarExpertTransactionUrl(details.network, details.settlementTransactionHash);
  return {
    to: details.to,
    subject: `You were paid ${paid}`,
    text: [
      `Your ${product.name} request${forNote} was paid. ${paid} is in ${wallet}.`,
      ...(transactionUrl === null ? [] : [`The payment on Stellar: ${transactionUrl}`]),
      `Your requests: ${dashboardUrl}`,
    ].join("\n\n"),
    html: [
      `<p>Your ${product.name} request${escapeHtml(forNote)} was paid. <strong>${escapeHtml(paid)}</strong> is in ${escapeHtml(wallet)}.</p>`,
      ...(transactionUrl === null
        ? []
        : [`<p><a href="${escapeHtml(transactionUrl)}">See the payment on Stellar</a></p>`]),
      `<p><a href="${escapeHtml(dashboardUrl)}">Your requests</a></p>`,
    ].join("\n"),
  };
}

export function stellarExpertTransactionUrl(network: StellarNetwork, hash: string): string {
  const explorerNetwork = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${encodeURIComponent(hash)}`;
}

// The note is the receiver's own text, but it is still text, never markup.
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
