/** List the meaningful tradeable bets (BTC above/below strike) on a live oracle. */
import "../src/loadenv.js";
import { PRICE_SCALE } from "../src/config.js";
import { readOracleObject, getBinaryTradeAmounts, getAskBounds } from "../src/sui/reads.js";
import { listInsurableOracles, getOracleState } from "../src/services/oracle.js";

async function main() {
  const oracles = await listInsurableOracles();
  let o = null;
  for (const c of [...oracles].reverse()) { const s = await getOracleState(c.oracleId, { forceFresh: true }); if (s.status === "ACTIVE") { o = s; break; } }
  if (!o) throw new Error("no active oracle");
  const live = await readOracleObject(o.oracleId);
  const spot = Number(live.spotPrice) / PRICE_SCALE;
  const bounds = await getAskBounds(o.oracleId);
  const min = Number(bounds.min) / PRICE_SCALE, max = Number(bounds.max) / PRICE_SCALE;
  console.log(`Market: BTC · expires ${new Date(o.expiryTimestamp).toISOString()}`);
  console.log(`Spot now: $${spot.toFixed(0)} · tradeable when probability is between ${min} and ${max}\n`);
  const qty = 1_000_000n;
  const px = async (isUp: boolean, strike: bigint) => {
    try { const r = await getBinaryTradeAmounts({ oracleId: o!.oracleId, expiry: BigInt(o!.expiryTimestamp), strike, isUp, quantity: qty }); return Number(r.cost) / Number(qty); }
    catch { return null; }
  };
  const base = Math.round(spot / 1000) * 1000;
  const rows: string[] = [];
  for (let s = base - 8000; s <= base + 8000; s += 1000) {
    const strike = BigInt(s) * BigInt(PRICE_SCALE);
    const up = await px(true, strike);
    const down = await px(false, strike);
    const upOk = up !== null && up >= min && up <= max;
    const downOk = down !== null && down >= min && down <= max;
    if (!upOk && !downOk) continue;
    rows.push(
      `$${s.toLocaleString().padEnd(8)}  ABOVE: ${upOk ? (up! * 100).toFixed(0) + "%" : "—"}   BELOW: ${downOk ? (down! * 100).toFixed(0) + "%" : "—"}`,
    );
  }
  console.log("STRIKE      P(BTC ABOVE)   P(BTC BELOW)");
  rows.forEach((r) => console.log(r));
}
main().catch((e) => { console.error(e); process.exit(1); });
