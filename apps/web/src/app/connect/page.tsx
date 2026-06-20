"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@/lib/testwallet";
import { useAddress } from "@/hooks/useKeel";
import { Card } from "@/components/ui";

export default function ConnectPage() {
  const address = useAddress();
  const router = useRouter();

  useEffect(() => {
    if (address) router.replace("/dashboard");
  }, [address, router]);

  return (
    <div style={{ maxWidth: 460, margin: "60px auto" }}>
      <Card style={{ textAlign: "center", padding: 40 }}>
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Connect your wallet</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          Connect a Sui testnet wallet to manage cover and underwriting on Keel.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ConnectButton />
        </div>
      </Card>
    </div>
  );
}
