"use client";

import Link from "next/link";
import { ConnectButton } from "@/lib/testwallet";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/buy-cover", label: "Buy cover" },
  { href: "/underwriter", label: "Underwrite" },
  { href: "/activity", label: "Activity" },
];

export function TopNav() {
  const path = usePathname();
  return (
    <header style={{ borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 24 }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)", textDecoration: "none" }}>
          ⚓ Keel
        </Link>
        <nav style={{ display: "flex", gap: 16, flex: 1 }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                color: path.startsWith(l.href) ? "var(--text)" : "var(--muted)",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
