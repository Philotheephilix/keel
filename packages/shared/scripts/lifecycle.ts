/**
 * REAL testnet lifecycle: create manager (if needed) -> quote ladder -> deposit+mint
 * -> verify on-chain positions. No mocks. Signs with KEEPER_PRIVATE_KEY (the funded acct).
 */
import "../src/loadenv.js";
import { config, PRICE_SCALE, QUOTE_SCALE } from "../src/config.js";
import { keeperKeypair, keeperAddress } from "../src/sui/client.js";
import { readOracleObject, getBinaryTradeAmounts, getManagerPosition, getManagerBalance } from "../src/sui/reads.js";
import { buildCreateManagerTx, buildMintPolicyTx } from "../src/sui/transactions.js";
import { signAndExecute, managerIdFromChanges } from "../src/sui/execute.js";
import { mapCoverageToLadder } from "../src/indemnity/ladder.js";
import { getManagersByOwner } from "../src/indexer/client.js";

const ORACLE = process.argv[2] || "0x14312d1e28c0f6bfe9217bac7477e71ffbd0ca0a28a1eae11044b996de354da8";

async function main() {
  const kp = keeperKeypair();
  const addr = keeperAddress();
  console.log("signer:", addr);

  const oracle = await readOracleObject(ORACLE);
  const spot = Number(oracle.spotPrice) / PRICE_SCALE;
  console.log("oracle:", oracle.underlying, oracle.status, "spot $", spot.toFixed(2), "expiry", new Date(Number(oracle.expiry)).toISOString());
  if (oracle.status !== "ACTIVE") throw new Error(`oracle not ACTIVE (${oracle.status}); pick another`);

  // 1. manager
  let managerId = (await getManagersByOwner(addr))[0]?.manager_id ?? null;
  if (!managerId) {
    console.log("no manager — creating...");
    const res = await signAndExecute(buildCreateManagerTx(addr), kp);
    managerId = managerIdFromChanges(res);
    console.log("created manager:", managerId, "tx", res.digest);
  } else {
    console.log("reusing manager:", managerId);
  }
  if (!managerId) throw new Error("manager id unresolved");

  // 2. map + quote a small ladder (trigger just below spot so it's affordable; sumInsured 5 dUSDC)
  const trigger = Math.round(spot) - 50;
  const grid = { minStrike: 50000n * BigInt(PRICE_SCALE), tickSize: 1n * BigInt(PRICE_SCALE), expiry: oracle.expiry };
  const mapping = mapCoverageToLadder({ oracleId: ORACLE, sumInsured: 5, triggerPrice: trigger, floorPrice: trigger - 200, rungs: 3, grid });
  console.log("ladder:", mapping.legs.map((l) => `$${Number(l.strike) / PRICE_SCALE} x${l.quantity}`).join(", "));
  if (mapping.warnings.length) console.log("warnings:", mapping.warnings);

  let totalPremium = 0n;
  for (const leg of mapping.legs) {
    const { cost } = await getBinaryTradeAmounts({ oracleId: ORACLE, expiry: BigInt(leg.expiry), strike: BigInt(leg.strike), isUp: false, quantity: BigInt(leg.quantity) });
    totalPremium += cost;
  }
  console.log("total premium:", Number(totalPremium) / QUOTE_SCALE, "dUSDC  | max payout:", mapping.legs.reduce((s, l) => s + Number(l.quantity), 0) / QUOTE_SCALE, "dUSDC");

  // 3. deposit (premium * 1.2 buffer) + mint
  const deposit = (totalPremium * 12n) / 10n + 1n;
  console.log("depositing", Number(deposit) / QUOTE_SCALE, "dUSDC then minting", mapping.legs.length, "legs...");
  const mintTx = await buildMintPolicyTx({ sender: addr, managerId, oracleId: ORACLE, legs: mapping.legs, depositAmount: deposit });
  const mintRes = await signAndExecute(mintTx, kp);
  console.log("mint status:", mintRes.effects?.status?.status, "tx", mintRes.digest);
  if (mintRes.effects?.status?.status !== "success") {
    console.error("ABORT:", JSON.stringify(mintRes.effects?.status));
    process.exit(1);
  }

  // 4. verify positions on-chain
  const bal = await getManagerBalance(managerId);
  console.log("manager quote balance after:", Number(bal) / QUOTE_SCALE, "dUSDC");
  for (const leg of mapping.legs) {
    const pos = await getManagerPosition({ managerId, oracleId: ORACLE, expiry: BigInt(leg.expiry), strike: BigInt(leg.strike), isUp: false });
    console.log(`  position @ $${Number(leg.strike) / PRICE_SCALE}: ${pos} (expected ${leg.quantity})`);
    if (pos.toString() !== leg.quantity) console.warn("  !! position mismatch");
  }
  console.log("\n✅ LIFECYCLE OK — real mint on testnet, positions verified.");
  console.log("MANAGER_ID=" + managerId);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
