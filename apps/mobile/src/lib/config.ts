// The Pomi web app, which serves both the API and the pay pages. The iOS
// simulator reaches the Mac's localhost directly; an Android emulator needs
// http://10.0.2.2:3000, and a phone the Mac's address on the network.
// Expo inlines EXPO_PUBLIC_ variables at build time, by this exact name.
const configuredAppUrl: unknown = process.env.EXPO_PUBLIC_APP_URL;

export const APP_URL = (
  typeof configuredAppUrl === "string" && configuredAppUrl !== ""
    ? configuredAppUrl
    : "http://localhost:3000"
).replace(/\/+$/, "");

export function requestLink(requestId: string): string {
  return `${APP_URL}/r/${requestId}`;
}

export function pageLink(handle: string): string {
  return `${APP_URL}/${handle}`;
}
