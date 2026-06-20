/**
 * Full Phase-3 buy flow against the soonest-expiring active oracle, sized IN-THE-MONEY
 * (down strikes above spot) so it will settle with a claim — sets up the keeper redeem
 * proof. Mirrors the frontend: build-mint -> sign -> confirm-mint (writes ledger + job).
 */
import "../src/loadenv.js";
import { Transaction } from "@mysten/sui/transactions";
import { PRICE_SCALE, QUOTE_SCALE } from "../src/config.js";
import { keeperKeypair, keeperAddress } from "../src/sui/client.js";
import { signAndExecute } from "../src/sui/execute.js";
import { listInsurableOracles, getOracleState } from "../src/services/oracle.js";
import { getOrCreateManager } from "../src/services/manager.js";
import { quoteCover } from "../src/services/quote.js";
import { buildMintTransaction, confirmPolicyMinted } from "../src/services/policy.js";

async function main() {
  const addr = keeperAddress();
  const oracles = await listInsurableOracles();
  let oracle = null;
  for (const cand of oracles) {
    const s = await getOracleState(cand.oracleId, { forceFresh: true });
    if (s.status === "ACTIVE") { oracle = s; break; }
  }
  if (!oracle) throw new Error("no active oracle");
  const minsLeft = (oracle.expiryTimestamp - Date.now()) / 60000;
  console.log("oracle", oracle.oracleId, "spot", oracle.spotPrice.toFixed(2), "expires in", minsLeft.toFixed(1), "min");

  const mgr = await getOrCreateManager(addr);
  if (!mgr.managerId) throw new Error("need manager");
  console.log("manager", mgr.managerId);

  // IN-THE-MONEY band: down strikes ABOVE spot -> pays if settle < strike (likely true)
  const trigger = Math.round(oracle.spotPrice) + 80;
  const floor = Math.round(oracle.spotPrice) + 20;
  const quote = await quoteCover({ oracleId: oracle.oracleId, sumInsured: 3, triggerPrice: trigger, floorPrice: floor, rungs: 3 });
  console.log("quote legs", quote.legs.length, "premium", (Number(quote.totalPremium) / QUOTE_SCALE).toFixed(4), "maxPayout", (Number(quote.totalMaxPayout) / QUOTE_SCALE).toFixed(2));
  console.log("strikes:", quote.perLeg.map((l) => `$${l.strike}(ask${l.perShareAsk.toFixed(2)},mint=${l.mintable})`).join(" "));
  if (quote.warnings.length) console.log("warnings", quote.warnings);
  if (quote.legs.length === 0) throw new Error("no mintable legs");

  const built = await buildMintTransaction({
    userAddress: addr, managerId: mgr.managerId, oracleId: oracle.oracleId,
    legs: quote.legs, totalPremium: quote.totalPremium, sumInsured: 3, triggerPrice: quote.snappedTriggerPrice, floorPrice: quote.snappedFloorPrice,
  });
  console.log("deposit", (Number(built.depositAmount) / QUOTE_SCALE).toFixed(4), "dUSDC; signing...");

  const tx = Transaction.from(Buffer.from(built.unsignedTxBytes, "base64"));
  const res = await signAndExecute(tx, keeperKeypair());
  console.log("mint", res.effects?.status?.status, res.digest);
  if (res.effects?.status?.status !== "success") { console.error(JSON.stringify(res.effects?.status)); process.exit(1); }

  const confirmed = await confirmPolicyMinted({
    userAddress: addr, managerId: mgr.managerId, mintTxDigest: res.digest,
    oracleId: oracle.oracleId, underlyingAsset: oracle.underlying, expiryTimestamp: oracle.expiryTimestamp,
    triggerPrice: quote.snappedTriggerPrice, legs: quote.legs, sumInsured: 3, premiumPaid: Number(quote.totalPremium) / QUOTE_SCALE,
  });
  console.log("\n✅ POLICY CONFIRMED:", confirmed.policyId, confirmed.status);
  console.log("ORACLE_ID=" + oracle.oracleId);
  console.log("POLICY_ID=" + confirmed.policyId);
  process.exit(0);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
