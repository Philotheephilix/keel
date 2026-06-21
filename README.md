# Keel

**Parametric crash insurance for crypto — built entirely out of prediction‑market positions.**
On‑chain, automatic, and trust‑minimized. Built on DeepBook Predict (Sui).

> 🌐 Live: frontend on Vercel · keeper + API exposed at `keel.philotheephilix.in`
> Planning, specs, and phase plans live in `docs/` (gitignored). Start at `docs/00-overview.md`.

---

## The one idea behind Keel

A prediction market lets you bet on a yes/no question. One of those questions is:

> *"Will the price of BTC be **below $60,000** at this date?"*

A position that pays **\$1 if yes, \$0 if no** is — economically — a **digital put option**. It pays you exactly when an asset falls past a level. That is the same shape as an insurance payout: *money arrives precisely when the bad thing happens.*

**Keel's insight: if one binary is a digital put, a *ladder* of binaries is a real insurance policy.** Stack a series of "below‑$X" markets at ascending strikes and the combined payout stops looking like a step and starts looking like a smooth, proportional loss curve. That curve *is* crash cover. So instead of building a new insurance protocol with its own risk pool, claims process, and adjusters, **Keel expresses insurance as a portfolio of prediction‑market positions** — and lets an existing, liquid, permissionless market do the pricing and settlement.

You don't file a claim. You don't wait for an adjuster. The market settles, the position pays, the money lands in your wallet.

---

## How a policy becomes a prediction‑market position

When you buy cover, you choose three things:

- **Sum insured** — how many dollars of protection you want (e.g. \$10,000).
- **Trigger price `T`** — the level where protection *starts* (e.g. BTC \$60,000).
- **Floor price `F`** — the level where you're *fully* paid out (e.g. BTC \$51,000).

Keel's **indemnity engine** (`packages/shared/src/indemnity/ladder.ts`) maps that request onto the live oracle grid and splits it into **N "down‑binary" legs** — each a prediction‑market position that pays if settlement is below its strike. The strikes ascend evenly between `F` and `T`, and each leg carries a slice of the sum insured.

As the price falls through the band, **one rung after another pays out**, so the aggregate tracks a linear loss curve:

```
payout(p) = sumInsured · (T − p) / (T − F)     clamped to [0, sumInsured]
```

**Worked example — \$10,000 of BTC cover, T = \$60,000, F = \$51,000:**

| BTC settles at | What happened              | Payout    |
| -------------- | -------------------------- | --------- |
| \$62,000       | Above trigger — no loss    | \$0       |
| \$58,500       | Down 25% of the band       | ~\$2,500  |
| \$55,500       | Halfway down the band      | ~\$5,000  |
| \$51,000       | At/below floor — max cover | \$10,000  |

The premium you pay is simply the **market price of that basket of binaries**. No actuary sets it; the order book does.

---

## Who provides the payout? Underwriters.

Every binary leg has two sides. Buyers take the "it crashes" side; **underwriters take the other side and collect the premium** for doing so. In Keel, underwriters supply capital to a vault that quotes and fills the binary ladders cover‑buyers request.

- If the market **doesn't** crash, underwriters keep the premiums — a yield on their capital.
- If it **does**, their capital pays the cover, exactly as the binaries settle on‑chain.

This is the same risk/return as selling puts or running an insurance book — but transparent, collateralized, and permissionless. Anyone can be the "insurance company."

A small **keeper** service (`apps/keeper`) watches for settled, in‑the‑money positions and redeems them permissionlessly, so payouts land in each policyholder's account without anyone having to ask.

---

## Why this helps everyone

**For the person buying cover**
- **Parametric, not bureaucratic** — payout is a function of price, computed by the curve above. No claims, no forms, no counterparty deciding whether you "qualify."
- **Pay once, protected immediately** — a single premium buys the whole ladder.
- **Self‑custodial** — your position and payout live in your own wallet; nothing to trust except the chain.
- **Honest pricing** — you pay what the market thinks the risk is worth, not a marked‑up actuarial guess.

**For underwriters / liquidity providers**
- A **new, recurring source of yield** that isn't correlated to lending rates or token emissions — it's premium income for bearing real, hedge‑able risk.
- Risk is **bounded and visible**: it's just the other side of clearly defined binary legs.

**For the prediction‑market ecosystem**
- Keel routes **organic, utility‑driven order flow** into prediction markets — orders that exist because someone wants protection, not because they're speculating.
- That demand **deepens liquidity and tightens spreads** on the very "below‑$X" markets everyone else trades, making the whole venue better.

---

## Why this brings *new* people to prediction markets

Prediction markets today are mostly used by speculators. Keel changes who shows up and why:

1. **A reason to participate that isn't gambling.** "Protect my portfolio from a crash" is a need millions of crypto holders already have. Keel turns that need into prediction‑market flow — users who would never place a "bet" will happily buy *insurance*.
2. **The complexity is hidden.** Buyers think in dollars, triggers, and payouts — not strikes, legs, and order books. Keel compiles a familiar insurance product down to prediction‑market positions under the hood, so the learning curve disappears.
3. **A two‑sided flywheel.** Cover‑buyers create demand; underwriters supply capital to earn the premiums; more capital means cheaper, deeper cover; cheaper cover attracts more buyers. Each side pulls the other in — and **both sides are net‑new users** for the underlying market.
4. **It defines a new derivative category.** Not a vanilla bet and not a traditional option — a **prediction‑market‑native insurance primitive**. Any real‑world "did X happen?" question with a market can become cover: depegs, liquidation cascades, protocol downtime, and beyond. Crypto crash insurance is just the first product on the rail.

In short: **prediction markets gave us a permissionless engine for pricing uncertainty. Keel points that engine at a problem everyone understands — "don't let a crash wipe me out" — and in doing so turns speculators' order books into infrastructure that protects ordinary holders.**

---

## Architecture

```
apps/web         Next.js 15 frontend + keel.* backend (API route handlers)
apps/keeper      long-running payout keeper service (redeems settled, in-the-money cover)
packages/shared  Prisma (Mongo) ledger, Sui/indexer clients, indemnity (ladder) engine, types
packages/sui-bindings   @mysten/codegen output for the Predict package
```

- **Frontend + API → Vercel.** The Next.js app serves the UI and the `keel.*` API routes (quote, buy, holdings, LP, stats). The client calls these via relative `/api/keel/*`.
- **Keeper → server.** A long-running process that polls for settlements and redeems in-the-money positions so payouts arrive automatically. Exposes a health/observability endpoint behind Caddy at `keel.philotheephilix.in`.
- **Settlement → DeepBook Predict on Sui.** Ground truth is always on-chain; the Mongo ledger is a derived, cached view.

## Quick start

```bash
pnpm install
cp .env.example .env     # fill real values; rotate any exposed secrets
pnpm db:generate && pnpm db:push
pnpm sui:codegen         # requires Phase 0 codegen config
pnpm dev:web             # http://localhost:3000
pnpm dev:keeper
```

## Build order

Phase 0 Foundation → 1 Read layer → 2 Quote/indemnity → 3 Buy cover → 4 Keeper → 5 Underwriter → 6 Polish/demo. Each phase has a validation + code-review gate (`docs/phases/`).

---

> **Status:** running on Sui **testnet**. This is a research/demo build of a novel primitive — not audited, not financial advice, not for production funds.
