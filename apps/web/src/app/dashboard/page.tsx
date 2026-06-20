"use client";

import Link from "next/link";
import { ConnectButton } from "@/lib/testwallet";
import { KeelApiError } from "@/lib/fetcher";
import { useAddress, useManager, useHoldings, usePolicies, useStats } from "@/hooks/useKeel";
import { CreateAccount } from "@/components/CreateAccount";
import { Card, Stat, Button, Spinner, ErrorBox, Empty, StatusBadge, ConnectPrompt } from "@/components/ui";
import { fmtUsd, countdownToTs } from "@/components/format";

function errMsg(e: unknown) {
  return e instanceof KeelApiError ? e.message : (e as Error)?.message ?? "Something went wrong";
}

export default function DashboardPage() {
  const address = useAddress();
  const manager = useManager();
  const holdings = useHoldings();
  const policies = usePolicies(["ACTIVE", "SETTLING"]);
  const stats = useStats();

  if (!address) {
    return (
      <div>
        <h1 style={{ fontSize: 28 }}>Dashboard</h1>
        <ConnectPrompt>
          <div style={{ marginBottom: 16 }}>Connect your wallet to view your dashboard.</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ConnectButton />
          </div>
        </ConnectPrompt>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Dashboard</h1>
        <Link href="/buy-cover">
          <Button>Buy cover</Button>
        </Link>
      </div>

      {/* Stats banner */}
      <Card>
        {stats.isLoading ? (
          <Spinner />
        ) : stats.isError ? (
          <ErrorBox message={errMsg(stats.error)} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            <Stat label="Total value protected" value={fmtUsd(stats.data!.totalValueProtected)} />
            <Stat label="Active policies" value={stats.data!.activePoliciesCount} />
            <Stat label="Premiums paid (all time)" value={fmtUsd(stats.data!.totalPremiumsPaidAllTime)} />
            <Stat label="Vault headroom" value={fmtUsd(stats.data!.vaultAvailableWithdrawal, 0)} />
          </div>
        )}
      </Card>

      {/* Manager creation */}
      {manager.isError && <ErrorBox message={errMsg(manager.error)} />}
      {manager.data?.needsCreation && manager.data.creationTxBytes && (
        <Card title="Create your Keel account">
          <CreateAccount address={address} creationTxBytes={manager.data.creationTxBytes} />
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Holdings */}
        <Card title="Your holdings">
          {holdings.isLoading ? (
            <Spinner />
          ) : holdings.isError ? (
            <ErrorBox message={errMsg(holdings.error)} />
          ) : !holdings.data || holdings.data.holdings.length === 0 ? (
            <Empty>No holdings detected on this address.</Empty>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={{ paddingBottom: 8 }}>Asset</th>
                  <th style={{ paddingBottom: 8 }}>Balance</th>
                  <th style={{ paddingBottom: 8, textAlign: "right" }}>USD</th>
                  <th style={{ paddingBottom: 8, textAlign: "right" }}>Insurable</th>
                </tr>
              </thead>
              <tbody>
                {holdings.data.holdings.map((h) => (
                  <tr key={h.coinType} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 0", fontWeight: 600 }}>{h.assetSymbol}</td>
                    <td style={{ padding: "8px 0" }}>{h.uiBalance.toLocaleString()}</td>
                    <td style={{ padding: "8px 0", textAlign: "right" }}>{fmtUsd(h.usdValue)}</td>
                    <td style={{ padding: "8px 0", textAlign: "right" }}>{h.insurable ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  <td colSpan={2} style={{ padding: "8px 0", color: "var(--muted)" }}>
                    Total
                  </td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700 }}>
                    {fmtUsd(holdings.data.totalUsdValue)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </Card>

        {/* Active policies */}
        <Card title="Active cover">
          {policies.isLoading ? (
            <Spinner />
          ) : policies.isError ? (
            <ErrorBox message={errMsg(policies.error)} />
          ) : !policies.data || policies.data.policies.length === 0 ? (
            <Empty>
              No active cover.{" "}
              <Link href="/buy-cover" style={{ color: "var(--accent)" }}>
                Buy cover
              </Link>
              .
            </Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {policies.data.policies.map((p) => (
                <Link
                  key={p.policyId}
                  href={`/policy/${p.policyId}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {p.asset} · {fmtUsd(p.sumInsured)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Trigger {fmtUsd(p.triggerPrice)} · expires in {countdownToTs(p.expiryTimestamp)}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
