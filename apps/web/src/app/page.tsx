import Link from "next/link";

export default function Landing() {
  return (
    <div style={{ padding: "60px 0" }}>
      <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: 0, maxWidth: 680 }}>
        Crash insurance for your crypto, backed by your own holdings.
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 18, marginTop: 20, maxWidth: 560 }}>
        Keel pays you automatically if your asset falls below a level you choose — parametric,
        on-chain, no claims process. Built on DeepBook Predict.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        <Link href="/buy-cover" className="btn-primary">
          Buy cover
        </Link>
        <Link href="/underwriter" className="btn-secondary">
          Earn as an underwriter
        </Link>
      </div>
      <style>{`
        .btn-primary{background:var(--accent);color:#06210f;padding:12px 22px;border-radius:10px;font-weight:600;text-decoration:none}
        .btn-secondary{border:1px solid var(--border);color:var(--text);padding:12px 22px;border-radius:10px;text-decoration:none}
      `}</style>
    </div>
  );
}
