import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@keel/shared", "@keel/sui-bindings"],
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  webpack: (config) => {
    // The shared package uses NodeNext-style `.js` import specifiers that point at `.ts`
    // sources. Teach webpack to resolve `.js` -> `.ts`/`.tsx` first.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
