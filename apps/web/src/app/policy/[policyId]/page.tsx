"use client";

import { use, useState } from "react";
import Link from "next/link";
import { KeelApiError } from "@/lib/fetcher";
import { usePolicy } from "@/hooks/useKeel";
import { Card, Stat, Spinner, ErrorBox, StatusBadge, Button } from "@/components/ui";
import { fmtUsd, countdown, fmtDate, priceFrom9Dec, SUISCAN_TX } from "@/components/format";

function errMsg(e: unknown) {
  return e instanceof KeelApiError ? e.message : (e as Error)?.message ?? "Something went wrong";
}

export default function PolicyPage({ params }: { params: Promise<{ policyId: string }> }) {
  const { policyId } = use(params);
  const [legsOpen, setLegsOpen] = useState(false);

  // We poll while ACTIVE/SETTLING; the hook reads status after first load, so poll always
  // and let server return fast. Simpler: poll always at 10s — cheap and correct.
  const policy = usePolicy(policyId, true);

  if (policy.isLoading) return <Spinner label="Loading policy…" />;
  if (policy.isError) return <ErrorBox message={errMsg(policy.error)} />;
  const p = policy.data!;

  const live = p.liveOracle;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/dashboard" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>
          ← Dashboard
        </Link>
        <StatusBadge status={p.status} />
      </div>

      <h1 style={{ fontSize: 28, margin: 0 }}>
        {p.asset} crash cover
      </h1>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          <Stat label="Sum insured" value={fmtUsd(p.sumInsured)} />
          <Stat label="Trigger price" value={fmtUsd(p.triggerPrice)} />
          <Stat label="Premium paid" value={fmtUsd(p.premiumPaid)} />
          <Stat
            label="Live spot"
            value={live ? fmtUsd(live.spotPrice) : "—"}
            sub={live ? `oracle ${live.status}` : undefined}
          />
          <Stat
            label="Time to expiry"
            value={live ? countdown(live.timeToExpirySeconds) : countdown((p.expiryTimestamp - Date.now()) / 1000)}
            sub={fmtDate(p.expiryTimestamp)}
          />
          {p.payoutAmount != null && <Stat label="Payout" value={fmtUsd(p.payoutAmount)} />}
        </div>
      </Card>

      <Card title="What this means">
        <p style={{ margin: 0, lineHeight: 1.6, fontSize: 15 }}>{p.explanation}</p>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Early exit / transfer isn’t supported in v1 — your cover runs to expiry and any
          payout is credited automatically to your Keel balance.
        </p>
      </Card>

      <Card>
        <Button variant="secondary" onClick={() => setLegsOpen((o) => !o)}>
          {legsOpen ? "Hide" : "Show"} per-leg breakdown ({p.legs.length})
        </Button>
        {legsOpen && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 14 }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={{ paddingBottom: 8 }}>Strike</th>
                <th style={{ paddingBottom: 8, textAlign: "right" }}>Quantity</th>
                <th style={{ paddingBottom: 8, textAlign: "right" }}>On-chain qty</th>
              </tr>
            </thead>
            <tbody>
              {p.legs.map((l, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 0" }}>{fmtUsd(priceFrom9Dec(l.strike))}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{l.quantity}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{l.onChainQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Transactions">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          {p.mintTxDigest ? (
            <a href={SUISCAN_TX(p.mintTxDigest)} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              Mint transaction ↗
            </a>
          ) : (
            <span style={{ color: "var(--muted)" }}>Mint transaction: —</span>
          )}
          {p.status === "PAID_OUT" &&
            (p.redeemTxDigest ? (
              <a
                href={SUISCAN_TX(p.redeemTxDigest)}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent)" }}
              >
                Redeem / payout transaction ↗
              </a>
            ) : (
              <span style={{ color: "var(--muted)" }}>Redeem transaction: pending</span>
            ))}
        </div>
      </Card>
    </div>
  );
}
