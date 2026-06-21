"use client";

import type { PolicyDto, LpPositionResp, LpHistoryEvent, HoldingsResp } from "@/hooks/types";
import { Card, Empty } from "@/components/ui";
import { fmtUsd } from "@/components/format";

/* Lightweight, dependency-free SVG/CSS charts in the notebook palette. */

const TAB = {
  mint: "#98d4bb",
  lavender: "#c7b8ea",
  pink: "#f4b8c5",
  sky: "#a8d8ea",
  cream: "#ffe6a7",
  ink: "#1a1a1a",
  rule: "#d8d2c4",
  soft: "#6b6358",
};

function Donut({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        <g transform="translate(70,70) rotate(-90)">
          <circle r={R} fill="none" stroke={TAB.rule} strokeWidth="20" opacity="0.4" />
          {data.map((d) => {
            const len = (d.value / total) * C;
            const seg = (
              <circle
                key={d.name}
                r={R}
                fill="none"
                stroke={d.color}
                strokeWidth="20"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return seg;
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" fontSize="11" fill={TAB.soft} fontFamily="var(--font-body)">
          Total
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="15" fontWeight="700" fill={TAB.ink} fontFamily="var(--font-display)">
          {fmtUsd(total, 0)}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ color: "var(--ink-soft)" }}>{d.name}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>{fmtUsd(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VBars({ data }: { data: { name: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 180, paddingTop: 8 }}>
      {data.map((d) => (
        <div key={d.name} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", textAlign: "center", gap: 8, height: "100%" }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{fmtUsd(d.value, d.value >= 1000 ? 0 : 2)}</div>
          <div
            style={{
              background: d.color,
              borderRadius: "6px 6px 0 0",
              height: `${(d.value / max) * 100}%`,
              minHeight: 4,
              transition: "height .6s var(--ease)",
            }}
          />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: "var(--ink-soft)", textTransform: "uppercase" }}>{d.name}</div>
        </div>
      ))}
    </div>
  );
}

function HBars({ data }: { data: { name: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d) => (
        <div key={d.name} style={{ display: "grid", gridTemplateColumns: "120px 1fr 28px", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{ color: "var(--ink-soft)", textTransform: "capitalize" }}>{d.name.toLowerCase()}</span>
          <div style={{ background: "var(--rule)", borderRadius: 6, height: 14, overflow: "hidden" }}>
            <div style={{ background: d.color, height: "100%", width: `${(d.value / max) * 100}%`, borderRadius: 6 }} />
          </div>
          <span style={{ fontWeight: 700, textAlign: "right" }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function Area({ series }: { series: { t: string; value: number }[] }) {
  const w = 100;
  const h = 60;
  const max = Math.max(...series.map((s) => s.value), 1);
  const pts = series.map((s, i) => {
    const x = series.length === 1 ? w : (i / (series.length - 1)) * w;
    const y = h - (s.value / max) * (h - 6) - 3;
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fill = `${line} L${w},${h} L0,${h} Z`;
  return (
    <div>
      <svg width="100%" height="160" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="lpgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TAB.mint} stopOpacity="0.7" />
            <stop offset="100%" stopColor={TAB.mint} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#lpgrad)" />
        <path d={line} fill="none" stroke={TAB.ink} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--ink-soft)" }}>
        <span>{series[0]?.t}</span>
        <span>now · {fmtUsd(series[series.length - 1]?.value ?? 0)}</span>
      </div>
    </div>
  );
}

export function DashboardCharts({
  holdings,
  policies,
  lp,
  lpHistory,
}: {
  holdings?: HoldingsResp;
  policies: PolicyDto[];
  lp?: LpPositionResp;
  lpHistory: LpHistoryEvent[];
}) {
  const walletUsd = holdings?.totalUsdValue ?? 0;
  const lpValue = lp?.currentValueUsd ?? 0;
  const active = policies.filter((p) => p.status === "ACTIVE" || p.status === "SETTLING");
  const insured = active.reduce((s, p) => s + p.sumInsured, 0);
  const premiums = policies.reduce((s, p) => s + p.premiumPaid, 0);
  const netSupplied = (lp?.totalSupplied ?? 0) - (lp?.totalWithdrawn ?? 0);

  const allocation = [
    { name: "Wallet (dUSDC)", value: walletUsd, color: TAB.mint },
    { name: "Underwriting", value: lpValue, color: TAB.lavender },
    { name: "Active cover", value: insured, color: TAB.sky },
  ].filter((d) => d.value > 0.0001);

  const glance = [
    { name: "Portfolio", value: walletUsd + lpValue, color: TAB.mint },
    { name: "Invested", value: premiums + Math.max(0, netSupplied), color: TAB.lavender },
    { name: "Insured", value: insured, color: TAB.sky },
  ];

  const sorted = [...lpHistory].sort((a, b) => a.timestamp - b.timestamp);
  let cum = 0;
  const series = sorted.map((e) => {
    cum += e.type === "supply" ? e.amount : -e.amount;
    return { t: new Date(e.timestamp).toLocaleDateString(), value: Math.max(0, cum) };
  });

  const statusOrder = ["ACTIVE", "SETTLING", "PAID_OUT", "EXPIRED_NO_CLAIM", "PENDING_CONFIRM", "FAILED"] as const;
  const statusColor: Record<string, string> = {
    ACTIVE: TAB.mint,
    SETTLING: TAB.cream,
    PAID_OUT: TAB.lavender,
    EXPIRED_NO_CLAIM: TAB.rule,
    PENDING_CONFIRM: TAB.sky,
    FAILED: TAB.pink,
  };
  const byStatus = statusOrder
    .map((s) => ({ name: s.replace(/_/g, " "), value: policies.filter((p) => p.status === s).length, color: statusColor[s] ?? TAB.rule }))
    .filter((d) => d.value > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <Card title="Portfolio allocation">
        {allocation.length === 0 ? <Empty>No assets, cover, or positions yet.</Empty> : <Donut data={allocation} />}
      </Card>
      <Card title="At a glance">
        <VBars data={glance} />
      </Card>
      <Card title="Underwriting capital over time">
        {series.length === 0 ? <Empty>No underwriting activity yet.</Empty> : <Area series={series} />}
      </Card>
      <Card title="Cover by status">
        {byStatus.length === 0 ? <Empty>No policies yet.</Empty> : <HBars data={byStatus} />}
      </Card>
    </div>
  );
}
