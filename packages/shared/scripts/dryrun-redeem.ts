/** devInspect redeem_permissionless on an existing position to validate call shape. */
import "../src/loadenv.js";
import { PRICE_SCALE } from "../src/config.js";
import { suiClient, keeperAddress } from "../src/sui/client.js";
import { buildRedeemPermissionlessTx } from "../src/sui/transactions.js";

const MGR = "0x3e2515ba04984f42c2b8ad5c4c24d70f19da1eaede47f84890f8eed80c49acaf";
const ORACLE = "0x14312d1e28c0f6bfe9217bac7477e71ffbd0ca0a28a1eae11044b996de354da8";
const EXPIRY = 1781955000000n;

async function main() {
  const tx = buildRedeemPermissionlessTx({
    sender: keeperAddress(),
    redemptions: [{ managerId: MGR, oracleId: ORACLE, expiry: EXPIRY, strike: BigInt(63427) * BigInt(PRICE_SCALE), quantity: 1000000n }],
  });
  const res = await suiClient().devInspectTransactionBlock({ sender: keeperAddress(), transactionBlock: tx });
  console.log("status:", res.effects?.status?.status);
  console.log("error:", res.error ?? res.effects?.status?.error ?? "(none)");
  // We EXPECT an abort here (oracle not settled). The point is to confirm it's a
  // protocol/state abort, NOT an argument/type mismatch (which would mean a bad builder).
}
main().catch((e) => { console.error(e); process.exit(1); });
