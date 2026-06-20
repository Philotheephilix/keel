/**
 * Underwriter (LP) flow. PLP lives in the user's wallet (supply returns Coin<PLP>).
 * Vault detail + LP history come from the indexer; the withdrawal limiter is read
 * on-chain (available_withdrawal) for confirmation-critical freshness.
 *
 * LP lifetime totals are DERIVED from indexer events (inherently idempotent) rather
 * than accumulated locally, so replaying a record call never double-counts.
 */
import { config, QUOTE_SCALE } from "../config.js";
import { prisma } from "../db/client.js";
import { suiClient } from "../sui/client.js";
import { getAvailableWithdrawal } from "../sui/reads.js";
import { buildSupplyTx, buildWithdrawTx } from "../sui/transactions.js";
import {
  getVaultSummaryIndexed,
  getLpSupplies,
  getLpWithdrawals,
  type IndexerLpEvent,
} from "../indexer/client.js";

// available_withdrawal returns ~u64::MAX when the limiter is disabled.
const LIMITER_DISABLED_THRESHOLD = 2n ** 63n;
// PLP shares are 6-dec (1:1 base scale with dUSDC; verified via supply shares_minted).
const PLP_SCALE = QUOTE_SCALE;

export type VaultSummary = {
  vaultValue: number;
  vaultBalance: number;
  totalMtm: number;
  totalMaxPayout: number;
  availableWithdrawal: number; // dUSDC; Infinity when limiter disabled
  availableLiquidity: number;
  plpTotalSupply: number;
  plpSharePrice: number;
  utilizationPct: number;
  limiterEnabled: boolean;
  note: string;
};

/** keel.getVaultSummary — full vault health from indexer, limiter headroom from chain. */
export async function getVaultSummary(): Promise<VaultSummary> {
  const [idx, availOnchain] = await Promise.all([
    getVaultSummaryIndexed(config.predictObjectId).catch(() => null),
    getAvailableWithdrawal().catch(() => 0n),
  ]);
  const unlimited = availOnchain >= LIMITER_DISABLED_THRESHOLD;
  const availUi = unlimited ? Number.POSITIVE_INFINITY : Number(availOnchain) / QUOTE_SCALE;
  return {
    vaultValue: (idx?.vault_value ?? 0) / QUOTE_SCALE,
    vaultBalance: (idx?.vault_balance ?? 0) / QUOTE_SCALE,
    totalMtm: (idx?.total_mtm ?? 0) / QUOTE_SCALE,
    totalMaxPayout: (idx?.total_max_payout ?? 0) / QUOTE_SCALE,
    availableWithdrawal: availUi,
    availableLiquidity: (idx?.available_liquidity ?? 0) / QUOTE_SCALE,
    plpTotalSupply: (idx?.plp_total_supply ?? 0) / PLP_SCALE,
    plpSharePrice: idx?.plp_share_price ?? 1,
    utilizationPct: (idx?.utilization ?? 0) * 100,
    limiterEnabled: !unlimited,
    note: unlimited ? "Withdrawal limiter is currently disabled." : "Withdrawal limiter active.",
  };
}

export type LpPosition = {
  plpBalance: string;
  plpUiBalance: number;
  currentValueUsd: number;
  totalSupplied: number;
  totalWithdrawn: number;
  unrealizedPnl: number;
  sharePrice: number;
  firstSupplyAt: number | null;
};

export async function getUserLpPosition(userAddress: string): Promise<LpPosition> {
  const [bal, vault, supplies, withdrawals] = await Promise.all([
    suiClient().getBalance({ owner: userAddress, coinType: config.plpCoinType }),
    getVaultSummary(),
    getLpSupplies(userAddress).catch(() => [] as IndexerLpEvent[]),
    getLpWithdrawals(userAddress).catch(() => [] as IndexerLpEvent[]),
  ]);
  const plpUi = Number(bal.totalBalance) / PLP_SCALE;
  const sharePrice = vault.plpSharePrice;
  const currentValueUsd = plpUi * sharePrice;
  const totalSupplied = supplies.reduce((s, e) => s + e.amount / QUOTE_SCALE, 0);
  const totalWithdrawn = withdrawals.reduce((s, e) => s + e.amount / QUOTE_SCALE, 0);
  const firstSupplyAt = supplies.length
    ? Math.min(...supplies.map((e) => e.checkpoint_timestamp_ms))
    : null;
  return {
    plpBalance: bal.totalBalance,
    plpUiBalance: plpUi,
    currentValueUsd,
    totalSupplied,
    totalWithdrawn,
    // PnL = current PLP value minus net deposits (supplied - withdrawn).
    unrealizedPnl: currentValueUsd - (totalSupplied - totalWithdrawn),
    sharePrice,
    firstSupplyAt,
  };
}

export type LpHistoryEvent = {
  type: "supply" | "withdraw";
  amount: number;
  shares: number;
  timestamp: number;
  txDigest: string;
};

/** keel.getUserLpHistory — chronological supply/withdraw feed from the indexer. */
export async function getUserLpHistory(userAddress: string): Promise<{ events: LpHistoryEvent[] }> {
  const [supplies, withdrawals] = await Promise.all([
    getLpSupplies(userAddress).catch(() => [] as IndexerLpEvent[]),
    getLpWithdrawals(userAddress).catch(() => [] as IndexerLpEvent[]),
  ]);
  const events: LpHistoryEvent[] = [
    ...supplies.map((e) => ({ type: "supply" as const, amount: e.amount / QUOTE_SCALE, shares: (e.shares_minted ?? 0) / PLP_SCALE, timestamp: e.checkpoint_timestamp_ms, txDigest: e.digest })),
    ...withdrawals.map((e) => ({ type: "withdraw" as const, amount: e.amount / QUOTE_SCALE, shares: (e.shares_burned ?? 0) / PLP_SCALE, timestamp: e.checkpoint_timestamp_ms, txDigest: e.digest })),
  ].sort((a, b) => b.timestamp - a.timestamp);
  return { events };
}

export async function buildSupplyTransaction(
  userAddress: string,
  amountUi: number,
): Promise<{ unsignedTxBytes: string; amount: string; estimatedPlpReceived: number }> {
  const amount = BigInt(Math.round(amountUi * QUOTE_SCALE));
  const [tx, vault] = await Promise.all([
    buildSupplyTx({ sender: userAddress, amount }),
    getVaultSummary().catch(() => null),
  ]);
  const bytes = await tx.build({ client: suiClient() });
  const estimatedPlpReceived = vault?.plpSharePrice ? amountUi / vault.plpSharePrice : amountUi;
  return { unsignedTxBytes: Buffer.from(bytes).toString("base64"), amount: amount.toString(), estimatedPlpReceived };
}

export async function buildWithdrawTransaction(
  userAddress: string,
  plpAmountUi: number,
): Promise<{ unsignedTxBytes: string; plpAmount: string } | { blocked: true; maxWithdrawableNow: number }> {
  const avail = await getAvailableWithdrawal();
  const unlimited = avail >= LIMITER_DISABLED_THRESHOLD;
  const availUi = Number(avail) / QUOTE_SCALE;
  // also guard against withdrawing more PLP than held
  const bal = await suiClient().getBalance({ owner: userAddress, coinType: config.plpCoinType });
  const heldPlp = Number(bal.totalBalance) / PLP_SCALE;
  if (plpAmountUi > heldPlp) {
    return { blocked: true, maxWithdrawableNow: heldPlp };
  }
  if (!unlimited && plpAmountUi > availUi) {
    return { blocked: true, maxWithdrawableNow: availUi };
  }
  const plpAmount = BigInt(Math.round(plpAmountUi * PLP_SCALE));
  const tx = await buildWithdrawTx({ sender: userAddress, plpAmount });
  const bytes = await tx.build({ client: suiClient() });
  return { unsignedTxBytes: Buffer.from(bytes).toString("base64"), plpAmount: plpAmount.toString() };
}

/**
 * Touch the user after a confirmed LP tx. Lifetime totals are derived from indexer
 * events (idempotent), so this no longer accumulates — it only ensures the user row
 * exists and refreshes lastSeen. Safe to call repeatedly with the same digest.
 */
export async function recordLpEvent(p: {
  userAddress: string;
  type: "supply" | "withdraw";
  amountUi: number;
  txDigest: string;
}): Promise<void> {
  await prisma.keelUser.upsert({
    where: { userAddress: p.userAddress },
    create: { userAddress: p.userAddress },
    update: { lastSeenAt: new Date() },
  });
}
