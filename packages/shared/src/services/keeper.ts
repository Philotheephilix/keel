/**
 * Payout Keeper logic (run by apps/keeper). Reactive to settlement (which happens when
 * the operator calls update_prices() AFTER expiry — never assume settlement at expiry).
 * Reads positions from chain at redeem time (never trusts the ledger), is idempotent
 * (re-checks non-zero quantity immediately before submitting), and only ever signs
 * redeem_permissionless (payout can only land in the position owner's manager).
 */
import { PRICE_SCALE, QUOTE_SCALE } from "../config.js";
import { prisma, PolicyStatus, KeeperJobStatus } from "../db/client.js";
import { keeperKeypair, keeperAddress } from "../sui/client.js";
import { getManagerPosition, readOracleObject } from "../sui/reads.js";
import { buildRedeemPermissionlessTx } from "../sui/transactions.js";
import { signAndExecute } from "../sui/execute.js";
import { getAllOracles } from "../indexer/client.js";

export type KeeperLog = (msg: string, meta?: Record<string, unknown>) => void;

const defaultLog: KeeperLog = (msg, meta) =>
  console.log(`[keeper] ${msg}`, meta ? JSON.stringify(meta) : "");

/**
 * watchSettlements (poll form): find keeper jobs still WATCHING whose oracle has settled,
 * and process them. Polling the indexer is the reliable path on testnet; an event stream
 * could front-run this but polling guarantees no missed settlement.
 */
const STUCK_JOB_MS = 2 * 60_000; // re-pick a job stuck mid-processing after 2 min

export async function pollSettlements(log: KeeperLog = defaultLog): Promise<string[]> {
  const stuckBefore = new Date(Date.now() - STUCK_JOB_MS);
  // WATCHING jobs, plus jobs stranded in TRIGGERED/PROCESSING by an earlier crash —
  // so a mid-flight failure retries instead of stranding the ledger.
  const jobs = await prisma.keelKeeperJob.findMany({
    where: {
      OR: [
        { status: KeeperJobStatus.WATCHING },
        { status: { in: [KeeperJobStatus.TRIGGERED, KeeperJobStatus.PROCESSING] }, lastCheckedAt: { lt: stuckBefore } },
      ],
    },
  });
  if (jobs.length === 0) return [];
  const oracles = await getAllOracles();
  const settledIds = new Set(
    oracles.filter((o) => o.status.toLowerCase() === "settled").map((o) => o.oracle_id),
  );
  const processed: string[] = [];
  for (const job of jobs) {
    if (!settledIds.has(job.oracleId)) continue;
    if (job.status === KeeperJobStatus.WATCHING) {
      log("settlement detected", { oracleId: job.oracleId, jobId: job.id });
    } else {
      log("retrying stranded job", { jobId: job.id, status: job.status });
    }
    await prisma.keelKeeperJob.update({ where: { id: job.id }, data: { status: KeeperJobStatus.TRIGGERED } });
    await processRedeems(job.id, log);
    processed.push(job.id);
  }
  return processed;
}

/** processRedeems — redeem in-the-money legs for every policy in a triggered job. */
export async function processRedeems(jobId: string, log: KeeperLog = defaultLog): Promise<void> {
  const job = await prisma.keelKeeperJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  await prisma.keelKeeperJob.update({
    where: { id: jobId },
    data: { status: KeeperJobStatus.PROCESSING, attempts: { increment: 1 } },
  });

  const oracle = await readOracleObject(job.oracleId);
  if (oracle.settlementPrice === null) {
    log("oracle not actually settled yet; re-watching", { oracleId: job.oracleId });
    await prisma.keelKeeperJob.update({ where: { id: jobId }, data: { status: KeeperJobStatus.WATCHING } });
    return;
  }
  const settlement = oracle.settlementPrice;
  log("settlement price", { oracleId: job.oracleId, settlement: Number(settlement) / PRICE_SCALE });

  const policies = await prisma.keelPolicy.findMany({ where: { policyId: { in: job.policiesToRedeem } } });

  type Redemption = { managerId: string; oracleId: string; expiry: bigint; strike: bigint; quantity: bigint };
  const redemptions: Redemption[] = [];
  const policyPayout = new Map<string, bigint>();

  for (const policy of policies) {
    let paid = 0n;
    for (const leg of policy.legs) {
      const strikeBase = BigInt(Math.round(leg.lowerStrike * PRICE_SCALE));
      const inMoney = settlement < strikeBase; // down-binary pays if settle < strike
      if (!inMoney) continue;
      // An in-money leg pays 1 quote base-unit per share. The payout lands in the owner's
      // manager regardless of who triggers it: either we redeem it now (if the position is
      // still open) or the protocol auto-credits it when the operator compacts the settled
      // oracle. So the payout is the LEDGER quantity, not the live position (which reads 0
      // once auto-credited). Verified on testnet: balance += sum(in-money qty) at settlement.
      paid += BigInt(leg.quantity);
      // Claim now only if the position is still open (not yet compacted) — avoids a
      // decrease_position underflow abort on already-settled positions.
      const open = await getManagerPosition({
        managerId: policy.predictManagerId,
        oracleId: policy.oracleId,
        expiry: leg.expiry,
        strike: strikeBase,
        isUp: false,
      });
      if (open > 0n) {
        redemptions.push({ managerId: policy.predictManagerId, oracleId: policy.oracleId, expiry: leg.expiry, strike: strikeBase, quantity: open });
      }
    }
    policyPayout.set(policy.policyId, paid);
  }

  let redeemDigest: string | null = null;
  if (redemptions.length > 0) {
    log("submitting redeem_permissionless", { count: redemptions.length, keeper: keeperAddress() });
    try {
      const tx = buildRedeemPermissionlessTx({ sender: keeperAddress(), redemptions });
      const res = await signAndExecute(tx, keeperKeypair());
      redeemDigest = res.digest;
      log("redeem ok", { digest: res.digest, status: res.effects?.status?.status });
    } catch (e) {
      log("redeem FAILED (will re-check state)", { error: (e as Error).message });
    }
  }

  // update ledger from settlement truth (chain-derived)
  for (const policy of policies) {
    const paid = policyPayout.get(policy.policyId) ?? 0n;
    await prisma.keelPolicy.update({
      where: { policyId: policy.policyId },
      data:
        paid > 0n
          ? { status: PolicyStatus.PAID_OUT, payoutAmount: Number(paid) / QUOTE_SCALE, redeemTxDigest: redeemDigest }
          : { status: PolicyStatus.EXPIRED_NO_CLAIM },
    });
  }

  await prisma.keelKeeperJob.update({ where: { id: jobId }, data: { status: KeeperJobStatus.DONE } });
  log("job done", { jobId, redeemed: redemptions.length });
}

/** reconcileManagerState — re-read positions and correct ledger status drift. */
export async function reconcileManagerState(managerId: string, log: KeeperLog = defaultLog): Promise<void> {
  const policies = await prisma.keelPolicy.findMany({
    where: { predictManagerId: managerId, status: { in: [PolicyStatus.ACTIVE, PolicyStatus.SETTLING] } },
  });
  for (const policy of policies) {
    let anyNonZero = false;
    for (const leg of policy.legs) {
      const qty = await getManagerPosition({
        managerId,
        oracleId: policy.oracleId,
        expiry: leg.expiry,
        strike: BigInt(Math.round(leg.lowerStrike * PRICE_SCALE)),
        isUp: false,
      });
      if (qty > 0n) anyNonZero = true;
    }
    const oracle = await readOracleObject(policy.oracleId).catch(() => null);
    if (!anyNonZero && oracle?.status === "SETTLED") {
      // positions cleared post-settlement — if not already resolved, mark settling for next sweep
      if (policy.status === PolicyStatus.ACTIVE) {
        log("reconcile: clearing drifted policy", { policyId: policy.policyId });
        await prisma.keelPolicy.update({ where: { policyId: policy.policyId }, data: { status: PolicyStatus.SETTLING } });
      }
    }
  }
}
