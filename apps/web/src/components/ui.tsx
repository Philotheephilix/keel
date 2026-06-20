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
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 20,
        ...style,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          {title && <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>}
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
    padding: "10px 18px",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 14,
    cursor: rest.disabled ? "not-allowed" : "pointer",
    opacity: rest.disabled ? 0.5 : 1,
    border: "1px solid transparent",
    transition: "opacity .15s",
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: "var(--accent)", color: "#06210f", border: "1px solid var(--accent)" },
    secondary: { background: "transparent", color: "var(--text)", border: "1px solid var(--border)" },
    ghost: { background: "transparent", color: "var(--muted)" },
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
      <div style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const statusColors: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: "rgba(74,222,128,.15)", fg: "var(--accent)" },
  SETTLING: { bg: "rgba(250,204,21,.15)", fg: "#facc15" },
  PENDING_CONFIRM: { bg: "rgba(139,151,173,.15)", fg: "var(--muted)" },
  PAID_OUT: { bg: "rgba(74,222,128,.2)", fg: "var(--accent)" },
  EXPIRED_NO_CLAIM: { bg: "rgba(139,151,173,.15)", fg: "var(--muted)" },
  FAILED: { bg: "rgba(248,113,113,.15)", fg: "#f87171" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] ?? { bg: "rgba(139,151,173,.15)", fg: "var(--muted)" };
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
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
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div style={{ color: "var(--muted)", fontSize: 14, padding: 12 }}>{label}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "rgba(248,113,113,.1)",
        border: "1px solid rgba(248,113,113,.4)",
        color: "#f87171",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ color: "var(--muted)", fontSize: 14, padding: "16px 0" }}>{children}</div>;
}

export function ConnectPrompt({ children }: { children?: ReactNode }) {
  return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 16, marginBottom: 16 }}>{children ?? "Connect your wallet to continue."}</div>
    </Card>
  );
}
