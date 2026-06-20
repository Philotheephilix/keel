/**
 * Buy-cover orchestration + Policy Ledger. The ledger is a derived cache; on-chain
 * manager state is ground truth and is reconciled on every read (docs/02 §4).
 */
import { PRICE_SCALE, QUOTE_SCALE, config } from "../config.js";
import { prisma, PolicyStatus } from "../db/client.js";
import { suiClient } from "../sui/client.js";
import { buildMintPolicyTx } from "../sui/transactions.js";
import { getManagerPosition, getBinaryTradeAmounts } from "../sui/reads.js";
import { getOracleState } from "./oracle.js";
import { KeelError } from "./quote.js";
import type { Leg } from "../types/index.js";

const DEPOSIT_BUFFER_NUM = 12n; // 1.2x premium to absorb spread drift between quote and execution
const DEPOSIT_BUFFER_DEN = 10n;

export type BuildMintResult = {
  unsignedTxBytes: string; // base64
  depositAmount: string; // base units
  summary: {
    asset: string;
    sumInsured: number;
    premium: number;
    triggerPrice: number;
    floorPrice: number;
    expiry: number;
    legCount: number;
  };
};

export async function buildMintTransaction(params: {
  userAddress: string;
  managerId: string;
  oracleId: string;
  legs: Leg[];
  totalPremium: string; // base units, from quote
  sumInsured: number;
  triggerPrice: number;
  floorPrice: number;
}): Promise<BuildMintResult> {
  if (params.legs.length === 0) throw new KeelError("NO_LEGS", "No legs to mint.");

  // Do NOT trust the client-supplied premium — re-price every leg from the live
  // protocol read (in parallel) so the deposit always covers the actual on-chain cost.
  const costs = await Promise.all(
    params.legs.map((leg) =>
      getBinaryTradeAmounts({
        oracleId: leg.oracleId,
        expiry: BigInt(leg.expiry),
        strike: BigInt(leg.strike),
        isUp: false,
        quantity: BigInt(leg.quantity),
      }).then((r) => r.cost),
    ),
  );
  const premium = costs.reduce((s, c) => s + c, 0n);
  const deposit = (premium * DEPOSIT_BUFFER_NUM) / DEPOSIT_BUFFER_DEN + 1n;

  const oracle = await getOracleState(params.oracleId);
  const tx = await buildMintPolicyTx({
    sender: params.userAddress,
    managerId: params.managerId,
    oracleId: params.oracleId,
    legs: params.legs,
    depositAmount: deposit,
  });
  const bytes = await tx.build({ client: suiClient() });

  return {
    unsignedTxBytes: Buffer.from(bytes).toString("base64"),
    depositAmount: deposit.toString(),
    summary: {
      asset: oracle.underlying,
      sumInsured: params.sumInsured,
      premium: Number(premium) / QUOTE_SCALE,
      triggerPrice: params.triggerPrice,
      floorPrice: params.floorPrice,
      expiry: oracle.expiryTimestamp,
      legCount: params.legs.length,
    },
  };
}

export type ConfirmParams = {
  userAddress: string;
  managerId: string;
  mintTxDigest: string;
  oracleId: string;
  underlyingAsset: string;
  expiryTimestamp: number;
  triggerPrice: number;
  legs: Leg[];
  sumInsured: number;
  premiumPaid: number; // dUSDC human
};

/** keel.confirmPolicyMinted — verify finality, write ledger ACTIVE, register keeper job. */
export async function confirmPolicyMinted(p: ConfirmParams): Promise<{ policyId: string; status: PolicyStatus }> {
  // idempotency: a policy for this digest may already exist
  const existing = await prisma.keelPolicy.findFirst({ where: { mintTxDigest: p.mintTxDigest } });
  if (existing) return { policyId: existing.policyId, status: existing.status };

  await suiClient().waitForTransaction({ digest: p.mintTxDigest });
  const tx = await suiClient().getTransactionBlock({ digest: p.mintTxDigest, options: { showEffects: true } });
  const ok = tx.effects?.status?.status === "success";

  await prisma.keelUser.upsert({
    where: { userAddress: p.userAddress },
    create: { userAddress: p.userAddress, predictManagerId: p.managerId },
    update: { predictManagerId: p.managerId, lastSeenAt: new Date() },
  });

  let policy;
  try {
    policy = await prisma.keelPolicy.create({
      data: {
        userAddress: p.userAddress,
        predictManagerId: p.managerId,
        underlyingAsset: p.underlyingAsset,
        oracleId: p.oracleId,
        expiryTimestamp: BigInt(p.expiryTimestamp),
        triggerPrice: p.triggerPrice,
        sumInsured: p.sumInsured,
        premiumPaid: p.premiumPaid,
        status: ok ? PolicyStatus.ACTIVE : PolicyStatus.FAILED,
        mintTxDigest: p.mintTxDigest,
        legs: {
          set: p.legs.map((l) => ({
            legIndex: l.legIndex,
            type: "binary" as const,
            oracleId: l.oracleId,
            expiry: BigInt(l.expiry),
            lowerStrike: Number(l.strike) / PRICE_SCALE,
            higherStrike: null,
            isUp: false,
            quantity: l.quantity,
          })),
        },
      },
    });
  } catch (e) {
    // unique-violation on mintTxDigest => a concurrent confirm already created it
    const dup = await prisma.keelPolicy.findFirst({ where: { mintTxDigest: p.mintTxDigest } });
    if (dup) return { policyId: dup.policyId, status: dup.status };
    throw e;
  }

  if (ok) {
    await prisma.keelKeeperJob.upsert({
      where: { oracleId_expiryTimestamp: { oracleId: p.oracleId, expiryTimestamp: BigInt(p.expiryTimestamp) } },
      create: {
        oracleId: p.oracleId,
        expiryTimestamp: BigInt(p.expiryTimestamp),
        policiesToRedeem: [policy.policyId],
      },
      update: { policiesToRedeem: { push: policy.policyId } },
    });
  }
  return { policyId: policy.policyId, status: policy.status };
}

export type PolicyDto = {
  policyId: string;
  asset: string;
  sumInsured: number;
  triggerPrice: number;
  premiumPaid: number;
  status: PolicyStatus;
  expiryTimestamp: number;
  legs: Array<{ strike: number; quantity: string; onChainQuantity: string }>;
  liveOracle: { spotPrice: number; status: string; timeToExpirySeconds: number } | null;
  payoutAmount: number | null;
  mintTxDigest: string | null;
  redeemTxDigest: string | null;
  explanation: string;
};

/** Reconcile a single policy against on-chain manager positions. Chain wins. */
async function reconcile(policyId: string): Promise<PolicyDto> {
  const policy = await prisma.keelPolicy.findUnique({ where: { policyId } });
  if (!policy) throw new KeelError("NOT_FOUND", `policy ${policyId} not found`);

  const legsWithChain = await Promise.all(
    policy.legs.map(async (l) => {
      const onChain = await getManagerPosition({
        managerId: policy.predictManagerId,
        oracleId: l.oracleId,
        expiry: l.expiry,
        strike: BigInt(Math.round(l.lowerStrike * PRICE_SCALE)),
        isUp: false,
      });
      return { strike: l.lowerStrike, quantity: l.quantity, onChainQuantity: onChain.toString() };
    }),
  );

  const oracle = await getOracleState(policy.oracleId).catch(() => null);

  // Status reconciliation backstop (the keeper is the primary settler). Only finalize a
  // policy once the oracle is genuinely SETTLED with a settlement price. In-money is
  // determined by settlement price vs each leg's strike — NOT by on-chain position being
  // zero (which is true for both paid-out and expired legs after compaction).
  let status = policy.status;
  let payoutAmount = policy.payoutAmount;
  const finalizable = policy.status === PolicyStatus.ACTIVE || policy.status === PolicyStatus.SETTLING;
  if (finalizable && oracle?.status === "SETTLED" && oracle.settlementPrice !== null) {
    const inMoney = policy.legs.filter((l) => oracle.settlementPrice! < l.lowerStrike);
    if (inMoney.length > 0) {
      const paidBase = inMoney.reduce((s, l) => s + Number(l.quantity), 0); // 1 base-unit/share
      payoutAmount = paidBase / QUOTE_SCALE;
      status = PolicyStatus.PAID_OUT;
    } else {
      status = PolicyStatus.EXPIRED_NO_CLAIM;
    }
  } else if (finalizable && oracle?.status === "PENDING_SETTLEMENT") {
    status = PolicyStatus.SETTLING;
  }
  if (status !== policy.status || payoutAmount !== policy.payoutAmount) {
    await prisma.keelPolicy.update({ where: { policyId }, data: { status, payoutAmount } });
  }

  const live = oracle
    ? {
        spotPrice: oracle.spotPrice,
        status: oracle.status,
        timeToExpirySeconds: Math.max(0, Math.round((Number(policy.expiryTimestamp) - Date.now()) / 1000)),
      }
    : null;

  return {
    policyId: policy.policyId,
    asset: policy.underlyingAsset,
    sumInsured: policy.sumInsured,
    triggerPrice: policy.triggerPrice,
    premiumPaid: policy.premiumPaid,
    status,
    expiryTimestamp: Number(policy.expiryTimestamp),
    legs: legsWithChain,
    liveOracle: live,
    payoutAmount,
    mintTxDigest: policy.mintTxDigest,
    redeemTxDigest: policy.redeemTxDigest,
    explanation: explain(policy.triggerPrice, policy.sumInsured, status, oracle?.settlementPrice ?? null),
  };
}

function explain(trigger: number, sumInsured: number, status: PolicyStatus, settlement: number | null): string {
  if (status === PolicyStatus.PAID_OUT && settlement !== null) {
    return `BTC settled at $${settlement.toLocaleString()}, below your $${trigger.toLocaleString()} trigger — your claim was paid into your Keel balance.`;
  }
  if (status === PolicyStatus.EXPIRED_NO_CLAIM && settlement !== null) {
    return `BTC settled at $${settlement.toLocaleString()}, above your $${trigger.toLocaleString()} trigger — no claim due.`;
  }
  return `Pays up to $${sumInsured.toLocaleString()} into your Keel balance if BTC settles below $${trigger.toLocaleString()} at expiry.`;
}

export async function getUserPolicies(userAddress: string, statusFilter?: PolicyStatus[]): Promise<PolicyDto[]> {
  const rows = await prisma.keelPolicy.findMany({
    where: { userAddress, ...(statusFilter ? { status: { in: statusFilter } } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(rows.map((r) => reconcile(r.policyId)));
}

export async function getPolicyDetail(policyId: string): Promise<PolicyDto> {
  return reconcile(policyId);
}

/**
 * keel.cancelOrRedeemEarly — MVP read-only. Early self-exit before settlement is possible
 * on-chain (redeem/redeem_range), but resale to a third party needs a tokenized-share
 * wrapper that is out of scope for v1, so the product surface reports it unsupported.
 */
export function cancelOrRedeemEarly(_policyId: string): { supported: false; reason: string } {
  return {
    supported: false,
    reason: "Early exit / transfer isn't supported in v1. Your cover runs to expiry; any payout is credited automatically.",
  };
}
