"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/lib/wallet";
import { useAddress, useFaucet } from "@/hooks/useKeel";
import { KeelApiError } from "@/lib/fetcher";
import type { ReactNode } from "react";

const links = [
  { href: "/app", label: "Dashboard" },
  { href: "/buy-cover", label: "Buy cover" },
  { href: "/underwriter", label: "Underwrite" },
  { href: "/activity", label: "Activity" },
];

/** Masthead testnet faucet: claims 10 dUSDC + 1 SUI once per address. */
function FaucetPill() {
  const address = useAddress();
  const faucet = useFaucet();
  if (!address) return null;
  const err =
    faucet.error instanceof KeelApiError
      ? faucet.error.message
      : (faucet.error as Error | undefined)?.message;
  const label = faucet.isPending
    ? "Sending…"
    : faucet.isSuccess
      ? `+${faucet.data.dusdc} dUSDC · +${faucet.data.sui} SUI ✓`
      : "Faucet · 10 dUSDC + 1 SUI";
  return (
    <button
      type="button"
      onClick={() => faucet.mutate()}
      disabled={faucet.isPending || faucet.isSuccess}
      title={err ?? "Get testnet funds: 10 dUSDC + 1 SUI"}
      style={{
        font: "inherit",
        fontSize: 13,
        fontWeight: 600,
        padding: "7px 14px",
        borderRadius: 8,
        cursor: faucet.isPending || faucet.isSuccess ? "default" : "pointer",
        background: faucet.isSuccess ? "var(--tab-1)" : "transparent",
        color: faucet.isError ? "#7a2233" : "var(--ink)",
        border: `1px solid ${faucet.isError ? "#e2a9b3" : "var(--rule)"}`,
        whiteSpace: "nowrap",
      }}
    >
      {faucet.isError ? "Faucet · try again" : label}
    </button>
  );
}

/** The cream-paper notebook shell (binder spine + holes + sticky masthead) for product pages. */
export function NotebookShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="nb-desk">
      <div className="nb-paper">
        <div className="nb-spine" aria-hidden="true">
          <div className="nb-holes" />
          <div className="nb-margin" />
        </div>

        <nav className="nb-tabs" aria-label="Primary">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "on" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <header className="nb-masthead">
          <Link href="/" className="nb-brand" aria-label="Keel home">
            <span className="word">Keel</span>
            <span className="dot" />
          </Link>
          <nav className="nb-nav" aria-label="Account">
            <FaucetPill />
            <ConnectButton />
          </nav>
        </header>

        <main className="nb-content">{children}</main>
      </div>
    </div>
  );
}
