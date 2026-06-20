/** Diagnose why the keeper redeemed 0 on an in-the-money settled policy. */
import "../src/loadenv.js";
import { PRICE_SCALE } from "../src/config.js";
import { keeperAddress } from "../src/sui/client.js";
import { readOracleObject, getManagerPosition } from "../src/sui/reads.js";
import { prisma } from "../src/db/client.js";

const POLICY = "0f18a7ec-b43e-4d73-a5af-71f4ddaa7a84";

async function main() {
  const p = await prisma.keelPolicy.findUnique({ where: { policyId: POLICY } });
  if (!p) throw new Error("policy not found");
  console.log("policy status:", p.status, "manager:", p.predictManagerId);
  const oracle = await readOracleObject(p.oracleId);
  console.log("oracle status:", oracle.status, "settlement:", oracle.settlementPrice ? Number(oracle.settlementPrice) / PRICE_SCALE : null);

  for (const leg of p.legs) {
    const strikeBase = BigInt(Math.round(leg.lowerStrike * PRICE_SCALE));
    const inMoney = oracle.settlementPrice !== null && oracle.settlementPrice < strikeBase;
    const pos = await getManagerPosition({
      managerId: p.predictManagerId, oracleId: p.oracleId, expiry: leg.expiry, strike: strikeBase, isUp: false,
    });
    console.log(`leg strike $${leg.lowerStrike}  storedQty=${leg.quantity}  onChainPos=${pos}  inMoney=${inMoney}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
