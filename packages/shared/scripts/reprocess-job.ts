/** Reset the settled job + policy and re-run the FIXED keeper to prove PAID_OUT. */
import "../src/loadenv.js";
import { prisma, PolicyStatus, KeeperJobStatus } from "../src/db/client.js";
import { processRedeems } from "../src/services/keeper.js";

const POLICY = "0f18a7ec-b43e-4d73-a5af-71f4ddaa7a84";

async function main() {
  const policy = await prisma.keelPolicy.findUnique({ where: { policyId: POLICY } });
  if (!policy) throw new Error("policy not found");
  const job = await prisma.keelKeeperJob.findUnique({
    where: { oracleId_expiryTimestamp: { oracleId: policy.oracleId, expiryTimestamp: policy.expiryTimestamp } },
  });
  if (!job) throw new Error("job not found");

  // reset to pre-processing state
  await prisma.keelPolicy.update({ where: { policyId: POLICY }, data: { status: PolicyStatus.ACTIVE, payoutAmount: null, redeemTxDigest: null } });
  await prisma.keelKeeperJob.update({ where: { id: job.id }, data: { status: KeeperJobStatus.TRIGGERED } });
  console.log("reset done; running fixed processRedeems...");

  await processRedeems(job.id);

  const after = await prisma.keelPolicy.findUnique({ where: { policyId: POLICY } });
  console.log("\nRESULT:", { status: after?.status, payout: after?.payoutAmount, redeemTx: after?.redeemTxDigest });
  if (after?.status === PolicyStatus.PAID_OUT && (after.payoutAmount ?? 0) > 0) {
    console.log("✅ KEEPER FIX VERIFIED — policy PAID_OUT with payout", after.payoutAmount, "dUSDC");
  } else {
    console.log("❌ still wrong");
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
