/** Prove LP supply + withdraw on testnet via the service builders. */
import "../src/loadenv.js";
import { Transaction } from "@mysten/sui/transactions";
import { QUOTE_SCALE } from "../src/config.js";
import { keeperKeypair, keeperAddress } from "../src/sui/client.js";
import { signAndExecute } from "../src/sui/execute.js";
import { buildSupplyTransaction, buildWithdrawTransaction, getUserLpPosition, recordLpEvent } from "../src/services/lp.js";

async function main() {
  const addr = keeperAddress();
  const before = await getUserLpPosition(addr);
  console.log("PLP before:", before.plpUiBalance);

  // supply 2 dUSDC
  const sup = await buildSupplyTransaction(addr, 2);
  const supRes = await signAndExecute(Transaction.from(Buffer.from(sup.unsignedTxBytes, "base64")), keeperKeypair());
  console.log("supply", supRes.effects?.status?.status, supRes.digest);
  await recordLpEvent({ userAddress: addr, type: "supply", amountUi: 2, txDigest: supRes.digest });

  const mid = await getUserLpPosition(addr);
  console.log("PLP after supply:", mid.plpUiBalance, "(+", (mid.plpUiBalance - before.plpUiBalance).toFixed(6), ")");

  // withdraw 1 PLP worth
  const wd = await buildWithdrawTransaction(addr, 1);
  if ("blocked" in wd) {
    console.log("withdraw blocked, max:", wd.maxWithdrawableNow);
  } else {
    const wdRes = await signAndExecute(Transaction.from(Buffer.from(wd.unsignedTxBytes, "base64")), keeperKeypair());
    console.log("withdraw", wdRes.effects?.status?.status, wdRes.digest);
    await recordLpEvent({ userAddress: addr, type: "withdraw", amountUi: 1, txDigest: wdRes.digest });
  }

  const after = await getUserLpPosition(addr);
  console.log("PLP after withdraw:", after.plpUiBalance, "| supplied", after.totalSupplied, "withdrawn", after.totalWithdrawn);
  console.log("\n✅ LP CYCLE OK");
  process.exit(0);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
