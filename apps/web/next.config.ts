import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @pomi/shared ships TypeScript source, so Next compiles it with the app.
  transpilePackages: ["@pomi/shared"],
  // The dev server serves its live reload only to hosts it is told about. A
  // phone on the local network opens Pomi at APP_URL's host, and without
  // this the pages there never hydrate. Production ignores it.
  allowedDevOrigins: appUrlHost(),
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  headers() {
    return Promise.resolve([
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]);
  },
};

export default nextConfig;

function appUrlHost(): string[] {
  const appUrl = process.env.APP_URL;
  if (appUrl === undefined || !URL.canParse(appUrl)) {
    return [];
  }
  return [new URL(appUrl).hostname];
}
