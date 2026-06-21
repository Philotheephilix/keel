import type { NextConfig } from "next";
import path from "node:path";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@keel/shared", "@keel/sui-bindings"],
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // Monorepo: trace from the repo root so the externalized Prisma client + its query
  // engine (in node_modules/.prisma/client) are bundled into the serverless functions.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  webpack: (config, { isServer }) => {
    // Official Prisma monorepo fix: copies the query engine binary next to the bundled
    // server output so it's resolvable on Vercel's serverless runtime.
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    // The shared package uses NodeNext-style `.js` import specifiers that point at `.ts`
    // sources. Teach webpack to resolve `.js` -> `.ts`/`.tsx` first.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    // Privy references optional connectors (Farcaster, Stripe onramp) we don't use; stub
    // them so webpack doesn't warn about unresolved modules.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@farcaster/mini-app-solana": false,
      "@farcaster/frame-sdk": false,
      "@stripe/crypto": false,
      "@stripe/stripe-js": false,
    };
    return config;
  },
};

export default nextConfig;
