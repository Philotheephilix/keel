"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { useState, type ReactNode } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Sui is a Tier-2 (extended) chain — its embedded wallet is created on demand via
        // useCreateWallet({ chainType: 'sui' }) (see ConnectButton), not via embeddedWallets.
        appearance: { theme: "dark", accentColor: "#4ade80", showWalletLoginFirst: false },
        loginMethods: ["email", "wallet", "google"],
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PrivyProvider>
  );
}
