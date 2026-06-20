/** One-off: learn get_trade_amounts semantics across strikes vs spot. */
import "../src/loadenv.js";
import { PRICE_SCALE, QUOTE_SCALE } from "../src/config.js";
import { readOracleObject, getBinaryTradeAmounts } from "../src/sui/reads.js";

const ORACLE = "0x14312d1e28c0f6bfe9217bac7477e71ffbd0ca0a28a1eae11044b996de354da8";

async function main() {
  const o = await readOracleObject(ORACLE);
  const spotD = Number(o.spotPrice) / PRICE_SCALE;
  console.log("spot $", spotD.toFixed(2), "status", o.status, "expiry", new Date(Number(o.expiry)).toISOString());
  const qty = 1_000_000n; // 1e6 shares
  // strikes from below spot (OTM for down) to above spot (ITM for down)
  for (const d of [-1000, -500, -100, 0, 100, 500, 1000]) {
    const strikeDollars = Math.round(spotD) + d;
    const strike = BigInt(strikeDollars) * BigInt(PRICE_SCALE);
    try {
      const { cost, payout } = await getBinaryTradeAmounts({
        oracleId: ORACLE, expiry: o.expiry, strike, isUp: false, quantity: qty,
      });
      console.log(
        `down strike $${strikeDollars} (spot${d >= 0 ? "+" : ""}${d})  cost=${(Number(cost) / QUOTE_SCALE).toFixed(6)}  2nd=${(Number(payout) / QUOTE_SCALE).toFixed(6)}  impliedProb=${(Number(cost) / Number(qty)).toFixed(4)}`,
      );
    } catch (e) {
      console.log(`down strike $${strikeDollars} ERROR ${(e as Error).message.slice(0, 80)}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
