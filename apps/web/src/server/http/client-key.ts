import "server-only";
import { createHmac } from "node:crypto";

// Identifies a client for rate limits without storing its address: an HMAC
// of the address the host reports in its own header. Null when the host is
// not configured to report one, since a header the client sets is no proof.
export function clientKey(request: Request, headerName: string | null, secret: string) {
  if (headerName === null) {
    return null;
  }
  const address = request.headers.get(headerName)?.split(",")[0]?.trim();
  if (address === undefined || address === "") {
    return null;
  }
  return createHmac("sha256", secret).update(`client:${address}`).digest("hex");
}
