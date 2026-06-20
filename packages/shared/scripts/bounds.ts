import "../src/loadenv.js";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { suiClient } from "../src/sui/client.js";
import { config, target, PRICE_SCALE, QUOTE_SCALE } from "../src/config.js";
import { readOracleObject, getBinaryTradeAmounts } from "../src/sui/reads.js";

const ORACLE = "0x14312d1e28c0f6bfe9217bac7477e71ffbd0ca0a28a1eae11044b996de354da8";
const Z = "0x0000000000000000000000000000000000000000000000000000000000000000";

async function u64call(module: string, fn: string, args: (tx: Transaction) => any[]) {
  const tx = new Transaction();
  tx.moveCall({ target: target(module, fn), arguments: args(tx) });
  const r = await suiClient().devInspectTransactionBlock({ sender: Z, transactionBlock: tx });
  if (r.error) return `ERR ${r.error}`;
  const rv = r.results?.[0]?.returnValues as [number[], string][] | undefined;
  return rv?.map(([b]) => bcs.u64().parse(Uint8Array.from(b))) ?? [];
}

async function main() {
  const o = await readOracleObject(ORACLE);
  const spot = Number(o.spotPrice) / PRICE_SCALE;
  console.log("spot $", spot.toFixed(2));
  console.log("ask_bounds(oracle):", await u64call("predict", "ask_bounds", (tx) => [tx.object(config.predictObjectId), tx.pure.id(ORACLE)]));
  console.log("base_spread:", await u64call("predict", "base_spread", (tx) => [tx.object(config.predictObjectId)]));
  console.log("min_spread:", await u64call("predict", "min_spread", (tx) => [tx.object(config.predictObjectId)]));
  console.log("max_total_exposure_pct:", await u64call("predict", "max_total_exposure_pct", (tx) => [tx.object(config.predictObjectId)]));

  // find the deepest OTM strike still mintable: per-share ask = cost/qty must be within ask_bounds
  console.log("\nper-share ask (cost/qty, scaled to [0,1]) across strikes:");
  const qty = 1_000_000n;
  for (const d of [-300, -200, -150, -100, -50, 0, 50, 100, 200]) {
    const strike = BigInt(Math.round(spot) + d) * BigInt(PRICE_SCALE);
    const { cost } = await getBinaryTradeAmounts({ oracleId: ORACLE, expiry: o.expiry, strike, isUp: false, quantity: qty });
    console.log(`  strike spot${d >= 0 ? "+" : ""}${d}: ask/share=${(Number(cost) / Number(qty)).toFixed(5)}  cost(qty1e6)=${(Number(cost) / QUOTE_SCALE).toFixed(4)} dUSDC`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
