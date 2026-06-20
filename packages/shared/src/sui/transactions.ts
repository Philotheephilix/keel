/**
 * PTB builders for every Keel write. Builders return an unsigned `Transaction`;
 * the web app hands it to the wallet, the keeper signs it directly.
 * Shared objects (Predict, manager, oracle, clock) are passed via tx.object(id);
 * the SuiClient resolves their shared versions at build/execution time.
 */
import { Transaction } from "@mysten/sui/transactions";
import { suiClient } from "./client.js";
import { config, target } from "../config.js";
import type { Leg } from "../types/index.js";

// Explicit gas budgets (MIST) so the SDK doesn't over-reserve. Without these, building
// against a thin wallet picks one small coin and inflates the budget, failing with
// "balance of gas object ... lower than the needed amount". Unused gas is refunded.
// mint is a multi-command PTB (deposit + coin ops + one market_key+mint per ladder rung),
// so it needs a generous budget; unused gas is refunded.
const GAS = { createManager: 30_000_000n, mint: 800_000_000n, lp: 120_000_000n };

/** create_manager() — shares a new PredictManager, returns its ID via object changes. */
export function buildCreateManagerTx(sender: string): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.setGasBudget(GAS.createManager);
  tx.moveCall({ target: target("predict", "create_manager"), arguments: [] });
  return tx;
}

/**
 * Select the owner's dUSDC coins to cover `amount` (base units), returning a PTB
 * argument for a coin of exactly `amount`. Merges fragments as needed.
 */
async function quoteCoinForAmount(tx: Transaction, owner: string, amount: bigint) {
  const { data } = await suiClient().getCoins({ owner, coinType: config.quoteAssetType });
  if (data.length === 0) throw new Error("no dUSDC coins in wallet");
  const sorted = [...data].sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
  let acc = 0n;
  const chosen: typeof sorted = [];
  for (const c of sorted) {
    chosen.push(c);
    acc += BigInt(c.balance);
    if (acc >= amount) break;
  }
  if (acc < amount) {
    throw new Error(
      `insufficient dUSDC: need ${amount}, have ${acc} (base units)`,
    );
  }
  const primary = tx.object(chosen[0]!.coinObjectId);
  if (chosen.length > 1) {
    tx.mergeCoins(primary, chosen.slice(1).map((c) => tx.object(c.coinObjectId)));
  }
  const [coin] = tx.splitCoins(primary, [tx.pure.u64(amount)]);
  return coin;
}

/**
 * Buy-cover tx: deposit `depositAmount` dUSDC into the manager, then mint each binary
 * down-leg. Manager must already exist (see Q5 — first-time users create it separately).
 */
export async function buildMintPolicyTx(params: {
  sender: string;
  managerId: string;
  oracleId: string;
  legs: Leg[];
  depositAmount: bigint; // base units; >= total premium (+ buffer for spread)
}): Promise<Transaction> {
  const tx = new Transaction();
  tx.setSender(params.sender);
  tx.setGasBudget(GAS.mint);

  const coin = await quoteCoinForAmount(tx, params.sender, params.depositAmount);
  tx.moveCall({
    target: target("predict_manager", "deposit"),
    typeArguments: [config.quoteAssetType],
    arguments: [tx.object(params.managerId), coin],
  });

  for (const leg of params.legs) {
    const key = tx.moveCall({
      target: target("market_key", "down"),
      arguments: [
        tx.pure.id(leg.oracleId),
        tx.pure.u64(BigInt(leg.expiry)),
        tx.pure.u64(BigInt(leg.strike)),
      ],
    });
    tx.moveCall({
      target: target("predict", "mint"),
      typeArguments: [config.quoteAssetType],
      arguments: [
        tx.object(config.predictObjectId),
        tx.object(params.managerId),
        tx.object(leg.oracleId),
        key,
        tx.pure.u64(BigInt(leg.quantity)),
        tx.object(config.clockObjectId),
      ],
    });
  }
  return tx;
}

/** supply(): deposit quote, receive PLP coin to the sender's wallet. */
export async function buildSupplyTx(params: {
  sender: string;
  amount: bigint;
}): Promise<Transaction> {
  const tx = new Transaction();
  tx.setSender(params.sender);
  tx.setGasBudget(GAS.lp);
  const coin = await quoteCoinForAmount(tx, params.sender, params.amount);
  const plp = tx.moveCall({
    target: target("predict", "supply"),
    typeArguments: [config.quoteAssetType],
    arguments: [tx.object(config.predictObjectId), coin, tx.object(config.clockObjectId)],
  });
  tx.transferObjects([plp], params.sender);
  return tx;
}

/** withdraw(): burn `plpAmount` PLP, receive quote coin back to the sender's wallet. */
export async function buildWithdrawTx(params: {
  sender: string;
  plpAmount: bigint;
}): Promise<Transaction> {
  const tx = new Transaction();
  tx.setSender(params.sender);
  tx.setGasBudget(GAS.lp);
  const { data } = await suiClient().getCoins({ owner: params.sender, coinType: config.plpCoinType });
  if (data.length === 0) throw new Error("no PLP coins in wallet");
  const sorted = [...data].sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
  const primary = tx.object(sorted[0]!.coinObjectId);
  if (sorted.length > 1) {
    tx.mergeCoins(primary, sorted.slice(1).map((c) => tx.object(c.coinObjectId)));
  }
  const [plpIn] = tx.splitCoins(primary, [tx.pure.u64(params.plpAmount)]);
  const quote = tx.moveCall({
    target: target("predict", "withdraw"),
    typeArguments: [config.quoteAssetType],
    arguments: [tx.object(config.predictObjectId), plpIn, tx.object(config.clockObjectId)],
  });
  tx.transferObjects([quote], params.sender);
  return tx;
}

/**
 * Keeper redeem: one PTB redeeming a set of in-the-money binary legs across managers
 * via redeem_permissionless (payout credited to each position owner's manager).
 */
export function buildRedeemPermissionlessTx(params: {
  sender: string;
  redemptions: Array<{ managerId: string; oracleId: string; expiry: bigint; strike: bigint; quantity: bigint }>;
}): Transaction {
  const tx = new Transaction();
  tx.setSender(params.sender);
  for (const r of params.redemptions) {
    const key = tx.moveCall({
      target: target("market_key", "down"),
      arguments: [tx.pure.id(r.oracleId), tx.pure.u64(r.expiry), tx.pure.u64(r.strike)],
    });
    tx.moveCall({
      target: target("predict", "redeem_permissionless"),
      typeArguments: [config.quoteAssetType],
      arguments: [
        tx.object(config.predictObjectId),
        tx.object(r.managerId),
        tx.object(r.oracleId),
        key,
        tx.pure.u64(r.quantity),
        tx.object(config.clockObjectId),
      ],
    });
  }
  return tx;
}
