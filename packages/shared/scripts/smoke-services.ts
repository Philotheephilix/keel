/** Smoke-test the keel.* service layer against live testnet + Mongo. */
import "../src/loadenv.js";
import { keeperAddress } from "../src/sui/client.js";
import { listInsurableOracles, getOracleState } from "../src/services/oracle.js";
import { getHoldings } from "../src/services/holdings.js";
import { quoteCover } from "../src/services/quote.js";
import { getProtocolStats } from "../src/services/stats.js";
import { getVaultSummary, getUserLpPosition } from "../src/services/lp.js";
import { getOrCreateManager } from "../src/services/manager.js";

async function main() {
  const addr = keeperAddress();
  console.log("addr:", addr);

  const oracles = await listInsurableOracles();
  console.log(`insurable oracles (active, future expiry): ${oracles.length}`);
  // find one that is genuinely ACTIVE on-chain (indexer status lags)
  let oracle = null;
  let state = null;
  for (const cand of oracles.slice(0, 10)) {
    const s = await getOracleState(cand.oracleId, { forceFresh: true });
    if (s.status === "ACTIVE") { oracle = cand; state = s; break; }
  }
  if (!oracle || !state) throw new Error("no genuinely-active oracle found");
  console.log("using oracle", oracle.oracleId, "expiry", new Date(oracle.expiryTimestamp).toISOString());
  console.log("oracle state:", { status: state.status, spot: state.spotPrice.toFixed(2), source: state.source });

  const mgr = await getOrCreateManager(addr);
  console.log("manager:", mgr.managerId ?? "(needs creation)", "needsCreation:", mgr.needsCreation);

  const holdings = await getHoldings(addr);
  console.log("holdings:", holdings.holdings.map((h) => `${h.assetSymbol}=${h.uiBalance} insurable=${h.insurable}`).join(", "), "total$", holdings.totalUsdValue.toFixed(2));

  const trigger = Math.round(state.spotPrice) - 50;
  const quote = await quoteCover({ oracleId: oracle.oracleId, sumInsured: 5, triggerPrice: trigger, floorPrice: trigger - 200, rungs: 4 });
  console.log("quote:", {
    legs: quote.legs.length,
    premium: (Number(quote.totalPremium) / 1e6).toFixed(4),
    maxPayout: (Number(quote.totalMaxPayout) / 1e6).toFixed(2),
    premiumPct: quote.premiumPctOfCoverage.toFixed(1) + "%",
    snappedTrigger: quote.snappedTriggerPrice,
  });
  if (quote.warnings.length) console.log("  warnings:", quote.warnings);

  const stats = await getProtocolStats();
  console.log("stats:", stats);

  const vault = await getVaultSummary();
  console.log("vault:", vault);

  const lp = await getUserLpPosition(addr);
  console.log("lp position:", { plp: lp.plpUiBalance, supplied: lp.totalSupplied });

  console.log("\n✅ SERVICES SMOKE OK");
  process.exit(0);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
