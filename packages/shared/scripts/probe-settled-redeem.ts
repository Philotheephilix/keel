import "../src/loadenv.js";
import { PRICE_SCALE, QUOTE_SCALE } from "../src/config.js";
import { suiClient, keeperAddress } from "../src/sui/client.js";
import { getManagerBalance, readOracleObject } from "../src/sui/reads.js";
import { buildRedeemPermissionlessTx } from "../src/sui/transactions.js";

const MGR = "0x3e2515ba04984f42c2b8ad5c4c24d70f19da1eaede47f84890f8eed80c49acaf";
const ORACLE = "0x6c85122e68f526cef2230015b40b83aa2f95fc2cfec2f20cd8b09b38af608545";
const EXPIRY = 1781955900000n; // placeholder; read real expiry below

async function main() {
  const o = await readOracleObject(ORACLE);
  console.log("oracle status", o.status, "settlement", o.settlementPrice ? Number(o.settlementPrice) / PRICE_SCALE : null, "expiry", Number(o.expiry));
  const bal = await getManagerBalance(MGR);
  console.log("manager quote balance now:", Number(bal) / QUOTE_SCALE, "dUSDC");

  // dry-run redeem with the ORIGINAL minted qty (1e6) at an in-money strike
  const strike = BigInt(63653) * BigInt(PRICE_SCALE);
  const tx = buildRedeemPermissionlessTx({
    sender: keeperAddress(),
    redemptions: [{ managerId: MGR, oracleId: ORACLE, expiry: o.expiry, strike, quantity: 1_000_000n }],
  });
  const res = await suiClient().devInspectTransactionBlock({ sender: keeperAddress(), transactionBlock: tx });
  console.log("redeem(qty=1e6) dryrun:", res.effects?.status?.status, res.error ?? res.effects?.status?.error ?? "");
}
main().catch((e) => { console.error(e); process.exit(1); });
