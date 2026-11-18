import { product } from "@pomi/shared";
import { type EmailMessage } from "../email/email-delivery";

// Apple Mail suggests a code above the keyboard when an email has the shape
// most code emails share, so this one keeps to it: "verification code", the
// phrase most senders use, and the code itself in the subject; one sentence
// that states it; the code whole in one element (never one cell per digit);
// and no hidden text. It is the only six-digit number in the message. Gmail's
// "Copy code" card appears only for senders Gmail picks; no markup or shape
// brings it.
export function signInEmail(to: string, code: string, lifetimeMinutes: number): EmailMessage {
  const lifetime = `It works for ${String(lifetimeMinutes)} minutes.`;
  const ignore =
    "If you didn't ask for this code, you can ignore this email. Nobody can sign in without it.";
  return {
    to,
    subject: `Your ${product.name} verification code: ${code}`,
    text: [
      `Your ${product.name} verification code is ${code}.`,
      `Enter it in ${product.name} to sign in. ${lifetime}`,
      ignore,
    ].join("\n\n"),
    html: signInEmailHtml(code, lifetime, ignore),
  };
}

// Inline styles and tables, since mail clients drop style sheets and most of
// modern CSS. Colors are the app's light palette.
function signInEmailHtml(code: string, lifetime: string, ignore: string): string {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>Your ${product.name} verification code</title>
</head>
<body style="margin:0;padding:0;background:#FBF8F5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF8F5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E8E2DB;border-radius:20px;">
<tr><td style="padding:32px;font-family:${font};">
<p style="margin:0 0 28px;font-size:18px;line-height:24px;font-weight:700;color:#1A1620;"><span style="display:inline-block;width:14px;height:14px;border-radius:7px;background:#F0613A;vertical-align:-1px;margin-right:8px;"></span>${product.name}</p>
<h1 style="margin:0 0 8px;font-size:24px;line-height:30px;font-weight:700;color:#1A1620;">Your verification code</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:24px;color:#5E5866;">Use this code to sign in to ${product.name}:</p>
<p style="margin:0 0 20px;padding:18px 0 18px 8px;background:#F3EFEA;border-radius:14px;text-align:center;font-family:${mono};font-size:34px;line-height:40px;font-weight:700;letter-spacing:8px;color:#1A1620;">${code}</p>
<p style="margin:0 0 12px;font-size:16px;line-height:24px;color:#5E5866;">${lifetime}</p>
<p style="margin:0;font-size:14px;line-height:21px;color:#736C79;">${ignore}</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-family:${font};font-size:12px;line-height:18px;color:#736C79;">${product.name}. ${product.tagline}</p>
</td></tr>
</table>
</body>
</html>`;
}
