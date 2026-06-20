"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@/lib/testwallet";
import { KeelApiError } from "@/lib/fetcher";
import { useAddress, usePolicies, useLpPosition, useLpHistory } from "@/hooks/useKeel";
import { Card, Stat, Spinner, ErrorBox, Empty, StatusBadge, ConnectPrompt } from "@/components/ui";
import { fmtUsd, fmtDate, SUISCAN_TX } from "@/components/format";

function errMsg(e: unknown) {
  return e instanceof KeelApiError ? e.message : (e as Error)?.message ?? "Something went wrong";
}

const STATUSES = ["ALL", "PENDING_CONFIRM", "ACTIVE", "SETTLING", "PAID_OUT", "EXPIRED_NO_CLAIM", "FAILED"];

export default function ActivityPage() {
  const address = useAddress();
  const policies = usePolicies();
  const position = useLpPosition();
  const lpHistory = useLpHistory();
  const [filter, setFilter] = useState("ALL");

  const rows = useMemo(() => {
    const all = policies.data?.policies ?? [];
    return filter === "ALL" ? all : all.filter((p) => p.status === filter);
  }, [policies.data, filter]);

  if (!address) {
    return (
      <div>
        <h1 style={{ fontSize: 28 }}>Activity</h1>
        <ConnectPrompt>
          <div style={{ marginBottom: 16 }}>Connect your wallet to view your activity.</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ConnectButton />
          </div>
        </ConnectPrompt>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Activity</h1>

      <Card title="Underwriting position">
        {position.isLoading ? (
          <Spinner />
        ) : position.isError ? (
          <ErrorBox message={errMsg(position.error)} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            <Stat label="PLP balance" value={position.data?.plpUiBalance.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "0"} />
            <Stat label="Current value" value={fmtUsd(position.data?.currentValueUsd ?? 0)} />
            <Stat label="Total supplied" value={fmtUsd(position.data?.totalSupplied ?? 0)} />
            <Stat label="Total withdrawn" value={fmtUsd(position.data?.totalWithdrawn ?? 0)} />
          </div>
        )}
      </Card>

      <Card title="Underwriting history">
        {lpHistory.isLoading ? (
          <Spinner />
        ) : lpHistory.isError ? (
          <ErrorBox message={errMsg(lpHistory.error)} />
        ) : (lpHistory.data?.events.length ?? 0) === 0 ? (
          <Empty>No supply or withdraw activity yet.</Empty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={{ paddingBottom: 8 }}>Type</th>
                <th style={{ paddingBottom: 8, textAlign: "right" }}>Amount</th>
                <th style={{ paddingBottom: 8, textAlign: "right" }}>Shares</th>
                <th style={{ paddingBottom: 8 }}>Date</th>
                <th style={{ paddingBottom: 8 }} />
              </tr>
            </thead>
            <tbody>
              {lpHistory.data!.events.map((e) => (
                <tr key={e.txDigest} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 0", fontWeight: 600, textTransform: "capitalize" }}>{e.type}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{fmtUsd(e.amount)}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{e.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: "8px 0" }}>{fmtDate(e.timestamp)}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>
                    <a href={SUISCAN_TX(e.txDigest)} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                      tx
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card
        title="Policies"
        actions={
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 13,
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        }
      >
        {policies.isLoading ? (
          <Spinner />
        ) : policies.isError ? (
          <ErrorBox message={errMsg(policies.error)} />
        ) : rows.length === 0 ? (
          <Empty>No policies for this filter.</Empty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={{ paddingBottom: 8 }}>Asset</th>
                <th style={{ paddingBottom: 8, textAlign: "right" }}>Sum insured</th>
                <th style={{ paddingBottom: 8, textAlign: "right" }}>Trigger</th>
                <th style={{ paddingBottom: 8, textAlign: "right" }}>Premium</th>
                <th style={{ paddingBottom: 8, textAlign: "right" }}>Payout</th>
                <th style={{ paddingBottom: 8 }}>Expiry</th>
                <th style={{ paddingBottom: 8 }}>Status</th>
                <th style={{ paddingBottom: 8 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.policyId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 0", fontWeight: 600 }}>{p.asset}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{fmtUsd(p.sumInsured)}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{fmtUsd(p.triggerPrice)}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{fmtUsd(p.premiumPaid)}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>
                    {p.payoutAmount != null ? fmtUsd(p.payoutAmount) : "—"}
                  </td>
                  <td style={{ padding: "8px 0" }}>{fmtDate(p.expiryTimestamp)}</td>
                  <td style={{ padding: "8px 0" }}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>
                    <Link href={`/policy/${p.policyId}`} style={{ color: "var(--accent)" }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
