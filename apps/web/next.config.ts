import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @pomi/shared ships TypeScript source, so Next compiles it with the app.
  transpilePackages: ["@pomi/shared"],
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
