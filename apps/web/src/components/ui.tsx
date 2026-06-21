"use client";

import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from "react";

export function Card({
  children,
  style,
  title,
  actions,
}: {
  children: ReactNode;
  style?: CSSProperties;
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fffdf8",
        border: "1px solid var(--rule)",
        borderRadius: 14,
        padding: 24,
        boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset, 0 6px 18px rgba(108,99,88,0.06)",
        ...style,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {title && (
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700 }}>
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  style,
  children,
  ...rest
}: {
  variant?: "primary" | "secondary" | "ghost";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 20px",
    borderRadius: 8,
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: 14,
    cursor: rest.disabled ? "not-allowed" : "pointer",
    opacity: rest.disabled ? 0.45 : 1,
    border: "1.5px solid var(--ink)",
    transition: "background .2s var(--ease), color .2s var(--ease), transform .2s var(--ease)",
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: "var(--ink)", color: "var(--bg-page)" },
    secondary: { background: "transparent", color: "var(--ink)" },
    ghost: { background: "transparent", color: "var(--ink-soft)", border: "1.5px solid var(--rule)" },
  };
  return (
    <button {...rest} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div
        style={{
          color: "var(--ink-soft)",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, marginTop: 4, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ color: "var(--ink-soft)", fontSize: 12, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const statusColors: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: "var(--tab-1)", fg: "#0f3a2b" },
  SETTLING: { bg: "var(--tab-5)", fg: "#6b4e00" },
  PENDING_CONFIRM: { bg: "var(--tab-4)", fg: "#0d3a4a" },
  PAID_OUT: { bg: "var(--tab-1)", fg: "#0f3a2b" },
  EXPIRED_NO_CLAIM: { bg: "var(--rule)", fg: "var(--ink-soft)" },
  FAILED: { bg: "var(--tab-3)", fg: "#7a2233" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] ?? { bg: "var(--rule)", fg: "var(--ink-soft)" };
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        padding: "3px 11px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  background: "#fff",
  border: "1px solid var(--rule)",
  borderRadius: 8,
  color: "var(--ink)",
  padding: "11px 13px",
  fontSize: 15,
  outline: "none",
};

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div style={{ color: "var(--ink-soft)", fontSize: 14, padding: 12 }}>{label}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "rgba(244,184,197,0.28)",
        border: "1px solid var(--tab-3)",
        color: "#7a2233",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ color: "var(--ink-soft)", fontSize: 14, padding: "16px 0" }}>{children}</div>;
}

export function ConnectPrompt({ children }: { children?: ReactNode }) {
  return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 16, marginBottom: 16 }}>{children ?? "Connect your wallet to continue."}</div>
    </Card>
  );
}
