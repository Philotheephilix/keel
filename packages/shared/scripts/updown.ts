/** Confirm the underlying market has UP (above) and DOWN (below) binaries at a strike. */
import "../src/loadenv.js";
import { PRICE_SCALE, QUOTE_SCALE } from "../src/config.js";
import { readOracleObject, getBinaryTradeAmounts } from "../src/sui/reads.js";
import { listInsurableOracles, getOracleState } from "../src/services/oracle.js";

async function main() {
  const oracles = await listInsurableOracles();
  // pick the LONGEST-dated active oracle (widest band so both up & down price near spot)
  let o = null;
  for (const c of [...oracles].reverse()) { const s = await getOracleState(c.oracleId, { forceFresh: true }); if (s.status === "ACTIVE") { o = s; break; } }
  if (!o) throw new Error("no active oracle");
  const live = await readOracleObject(o.oracleId);
  const spot = Number(live.spotPrice) / PRICE_SCALE;
  console.log(`oracle ${o.oracleId.slice(0,14)}  spot $${spot.toFixed(2)}  expiry ${new Date(o.expiryTimestamp).toISOString()}`);
  const qty = 1_000_000n; // 1e6 shares; max payout per side = 1.00 dUSDC
  console.log("\nstrike      P(BTC<strike) DOWN   P(BTC>strike) UP    sum (≈1.00 = one whole market)");
  const px = async (isUp: boolean, strike: bigint) => {
    try { const r = await getBinaryTradeAmounts({ oracleId: o!.oracleId, expiry: BigInt(o!.expiryTimestamp), strike, isUp, quantity: qty }); return Number(r.cost) / Number(qty); }
    catch { return null; }
  };
  for (const d of [-2000, -1000, 0, 1000, 2000]) {
    const strike = BigInt(Math.round(spot) + d) * BigInt(PRICE_SCALE);
    const pDown = await px(false, strike);
    const pUp = await px(true, strike);
    const f = (v: number | null) => (v === null ? " n/a " : v.toFixed(3));
    const sum = pDown !== null && pUp !== null ? (pDown + pUp).toFixed(3) : "—";
    console.log(`$${(Number(strike)/PRICE_SCALE).toFixed(0)} (spot${d>=0?"+":""}${d})   ${f(pDown)}              ${f(pUp)}              ${sum}`);
  }
  console.log("\nKeel buys the DOWN side (BTC below strike) — that's the crash payout.");
}
main().catch((e) => { console.error(e); process.exit(1); });
