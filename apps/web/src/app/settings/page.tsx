"use client";

import { ConnectButton } from "@/lib/testwallet";
import { useAddress } from "@/hooks/useKeel";
import { Card, ConnectPrompt, Stat } from "@/components/ui";
import { shortAddr } from "@/components/format";

export default function SettingsPage() {
  const address = useAddress();

  if (!address) {
    return (
      <div>
        <h1 style={{ fontSize: 28 }}>Settings</h1>
        <ConnectPrompt>Connect your wallet to view your account settings.</ConnectPrompt>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 28 }}>Settings</h1>
      <Card style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr 1fr", maxWidth: 620 }}>
        <Stat label="Connected address" value={shortAddr(address)} sub={address} />
        <Stat label="Network" value="Sui Testnet" />
        <div style={{ gridColumn: "1 / -1" }}>
          <ConnectButton />
        </div>
      </Card>
      <Card style={{ marginTop: 16, maxWidth: 620 }}>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>
          Notification preferences are out of scope for this release.
        </div>
      </Card>
    </div>
  );
}
