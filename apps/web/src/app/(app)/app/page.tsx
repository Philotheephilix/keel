"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ConnectButton } from "@/lib/wallet";
import { KeelApiError } from "@/lib/fetcher";
import {
  useAddress,
  useManager,
  useHoldings,
  usePolicies,
  useLpPosition,
  useLpHistory,
  useFaucet,
} from "@/hooks/useKeel";
import { CreateAccount } from "@/components/CreateAccount";
import { DashboardCharts } from "@/components/DashboardCharts";
import { Card, Stat, Button, Spinner, ErrorBox, Empty, StatusBadge, ConnectPrompt } from "@/components/ui";
import { fmtUsd, countdownToTs } from "@/components/format";

function errMsg(e: unknown) {
  return e instanceof KeelApiError ? e.message : (e as Error)?.message ?? "Something went wrong";
}

/** Testnet faucet: claim 10 dUSDC + 1 SUI once per address. */
function FaucetButton() {
  const faucet = useFaucet();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {faucet.isSuccess && (
        <span style={{ color: "#2f8f6b", fontSize: 12, fontWeight: 600 }}>
          +{faucet.data.dusdc} dUSDC{faucet.data.sui ? ` + ${faucet.data.sui} SUI` : ""} ✓
        </span>
      )}
      {faucet.isError && <span style={{ color: "#7a2233", fontSize: 12 }}>{errMsg(faucet.error)}</span>}
      <Button variant="secondary" onClick={() => faucet.mutate()} disabled={faucet.isPending}>
        {faucet.isPending ? "Sending…" : "Get 10 dUSDC + 1 SUI"}
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const address = useAddress();
  const manager = useManager();
  const holdings = useHoldings();
  const allPolicies = usePolicies();
  const lp = useLpPosition();
  const lpHistory = useLpHistory();

  const policies = allPolicies.data?.policies ?? [];
  const active = useMemo(
    () => policies.filter((p) => p.status === "ACTIVE" || p.status === "SETTLING"),
    [policies],
  );

  const walletUsd = holdings.data?.totalUsdValue ?? 0;
  const lpValue = lp.data?.currentValueUsd ?? 0;
  const insured = active.reduce((s, p) => s + p.sumInsured, 0);
  const premiums = policies.reduce((s, p) => s + p.premiumPaid, 0);
  const invested = premiums + Math.max(0, (lp.data?.totalSupplied ?? 0) - (lp.data?.totalWithdrawn ?? 0));

  if (!address) {
    return (
      <div>
        <h1 style={{ fontSize: 34, margin: "0 0 16px" }}>Dashboard</h1>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <h1 style={{ fontSize: 36, margin: 0 }}>Dashboard</h1>
        <Link href="/buy-cover">
          <Button>Buy cover →</Button>
        </Link>
      </div>

      {/* Portfolio stats */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          <Stat label="Portfolio value" value={fmtUsd(walletUsd + lpValue)} sub="wallet + underwriting" />
          <Stat label="Insured" value={fmtUsd(insured)} sub={`${active.length} active`} />
          <Stat label="Invested" value={fmtUsd(invested)} sub="premiums + supplied" />
          <Stat
            label="Unrealized PnL"
            value={
              <span style={{ color: (lp.data?.unrealizedPnl ?? 0) >= 0 ? "#2f8f6b" : "#7a2233" }}>
                {(lp.data?.unrealizedPnl ?? 0) >= 0 ? "+" : ""}
                {fmtUsd(lp.data?.unrealizedPnl ?? 0)}
              </span>
            }
            sub="underwriting"
          />
        </div>
      </Card>

      {/* Manager creation */}
      {manager.isError && <ErrorBox message={errMsg(manager.error)} />}
      {manager.data?.needsCreation && manager.data.creationTxBytes && (
        <Card title="Create your Keel account">
          <CreateAccount address={address} creationTxBytes={manager.data.creationTxBytes} />
        </Card>
      )}

      {/* Charts */}
      <DashboardCharts
        holdings={holdings.data}
        policies={policies}
        lp={lp.data}
        lpHistory={lpHistory.data?.events ?? []}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Holdings */}
        <Card title="Your holdings" actions={<FaucetButton />}>
          {holdings.isLoading ? (
            <Spinner />
          ) : holdings.isError ? (
            <ErrorBox message={errMsg(holdings.error)} />
          ) : !holdings.data || holdings.data.holdings.length === 0 ? (
            <Empty>No holdings detected on this address.</Empty>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ color: "var(--ink-soft)", textAlign: "left" }}>
                  <th style={{ paddingBottom: 8 }}>Asset</th>
                  <th style={{ paddingBottom: 8 }}>Balance</th>
                  <th style={{ paddingBottom: 8, textAlign: "right" }}>USD</th>
                  <th style={{ paddingBottom: 8, textAlign: "right" }}>Insurable</th>
                </tr>
              </thead>
              <tbody>
                {holdings.data.holdings.map((h) => (
                  <tr key={h.coinType} style={{ borderTop: "1px solid var(--rule)" }}>
                    <td style={{ padding: "8px 0", fontWeight: 600 }}>{h.assetSymbol}</td>
                    <td style={{ padding: "8px 0" }}>{h.uiBalance.toLocaleString()}</td>
                    <td style={{ padding: "8px 0", textAlign: "right" }}>{fmtUsd(h.usdValue)}</td>
                    <td style={{ padding: "8px 0", textAlign: "right" }}>{h.insurable ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--rule)" }}>
                  <td colSpan={2} style={{ padding: "8px 0", color: "var(--ink-soft)" }}>
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

        {/* Active cover */}
        <Card title="Active cover">
          {allPolicies.isLoading ? (
            <Spinner />
          ) : allPolicies.isError ? (
            <ErrorBox message={errMsg(allPolicies.error)} />
          ) : active.length === 0 ? (
            <Empty>
              No active cover.{" "}
              <Link href="/buy-cover" style={{ color: "var(--accent)", fontWeight: 600 }}>
                Buy cover
              </Link>
              .
            </Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {active.map((p) => (
                <Link
                  key={p.policyId}
                  href={`/policy/${p.policyId}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    border: "1px solid var(--rule)",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "var(--ink)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {p.asset} · {fmtUsd(p.sumInsured)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
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
