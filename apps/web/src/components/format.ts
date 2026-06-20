/** Display formatting helpers. */

export function usdFromBaseUnits(s: string | number | null | undefined): number {
  if (s == null) return 0;
  return Number(s) / 1e6;
}

export function priceFrom9Dec(s: string | number | null | undefined): number {
  if (s == null) return 0;
  return Number(s) / 1e9;
}

export function fmtUsd(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export function countdown(secondsOrMsFromNow: number): string {
  const s = Math.max(0, Math.floor(secondsOrMsFromNow));
  if (s <= 0) return "expired";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function countdownToTs(expiryMs: number): string {
  return countdown((expiryMs - Date.now()) / 1000);
}

export function shortAddr(a?: string | null): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export const SUISCAN_TX = (digest: string) => `https://suiscan.xyz/testnet/tx/${digest}`;
