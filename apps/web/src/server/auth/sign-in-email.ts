import { product } from "@pomi/shared";
import { type EmailMessage } from "../email/email-delivery";

export function signInEmail(to: string, code: string, lifetimeMinutes: number): EmailMessage {
  return {
    to,
    subject: `${code} is your ${product.name} sign-in code`,
    text: [
      `Your ${product.name} sign-in code is ${code}.`,
      `It works for ${String(lifetimeMinutes)} minutes. If you did not ask for it, you can ignore this email: nobody can sign in without the code.`,
    ].join("\n\n"),
    html: [
      `<p>Your ${product.name} sign-in code is</p>`,
      `<p style="font-size:28px;font-weight:600;letter-spacing:4px">${code}</p>`,
      `<p>It works for ${String(lifetimeMinutes)} minutes. If you did not ask for it, you can ignore this email: nobody can sign in without the code.</p>`,
    ].join("\n"),
  };
}
