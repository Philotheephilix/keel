/**
 * Read-only on-chain access to DeepBook Predict via devInspect and object reads.
 * No signing. Used by web (confirmation-critical freshness) and keeper.
 */
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { suiClient } from "./client.js";
import { config, target } from "../config.js";

const ZERO_SENDER = "0x0000000000000000000000000000000000000000000000000000000000000000";

/** Decode an array of u64 return values from a devInspect result entry. */
function decodeU64s(returnValues: [number[], string][] | undefined): bigint[] {
  if (!returnValues) return [];
  return returnValues.map(([bytes]) => bcs.u64().parse(Uint8Array.from(bytes))).map((s) => BigInt(s));
}

export type OracleStatus = "INACTIVE" | "ACTIVE" | "PENDING_SETTLEMENT" | "SETTLED";
const STATUS_BY_CODE: Record<number, OracleStatus> = {
  0: "INACTIVE",
  1: "ACTIVE",
  2: "PENDING_SETTLEMENT",
  3: "SETTLED",
};

/** Build a MarketKey for a down (is_up=false) binary in a PTB. Returns the call result. */
function buildDownKey(tx: Transaction, oracleId: string, expiry: bigint, strike: bigint) {
  return tx.moveCall({
    target: target("market_key", "down"),
    arguments: [tx.pure.id(oracleId), tx.pure.u64(expiry), tx.pure.u64(strike)],
  });
}

export function buildMarketKey(
  tx: Transaction,
  oracleId: string,
  expiry: bigint,
  strike: bigint,
  isUp: boolean,
) {
  return tx.moveCall({
    target: target("market_key", "new"),
    arguments: [tx.pure.id(oracleId), tx.pure.u64(expiry), tx.pure.u64(strike), tx.pure.bool(isUp)],
  });
}

/**
 * predict::get_trade_amounts(&Predict, &OracleSVI, MarketKey, qty, &Clock) -> (u64, u64)
 * VERIFIED EMPIRICALLY (scripts/probe against live testnet):
 *  - return[0] `cost`  = premium to mint (ask) = quantity * P(in-the-money), in quote base units.
 *  - return[1] `currentRedeemValue` = present bid/redeem value (intrinsic), NOT max payout.
 *  - A down-binary pays 1 quote base-unit per share at settlement if settle < strike,
 *    so MAX PAYOUT of a leg == quantity (see binaryMaxPayout). cost/qty -> 1.0 as strike rises ITM.
 */
export async function getBinaryTradeAmounts(params: {
  oracleId: string;
  expiry: bigint;
  strike: bigint;
  isUp: boolean;
  quantity: bigint;
}): Promise<{ cost: bigint; currentRedeemValue: bigint }> {
  const tx = new Transaction();
  const key = params.isUp
    ? buildMarketKey(tx, params.oracleId, params.expiry, params.strike, true)
    : buildDownKey(tx, params.oracleId, params.expiry, params.strike);
  tx.moveCall({
    target: target("predict", "get_trade_amounts"),
    arguments: [
      tx.object(config.predictObjectId),
      tx.object(params.oracleId),
      key,
      tx.pure.u64(params.quantity),
      tx.object(config.clockObjectId),
    ],
  });
  const res = await suiClient().devInspectTransactionBlock({
    sender: ZERO_SENDER,
    transactionBlock: tx,
  });
  if (res.error) throw new Error(`get_trade_amounts devInspect failed: ${res.error}`);
  const last = res.results?.[res.results.length - 1];
  const [cost, currentRedeemValue] = decodeU64s(last?.returnValues as [number[], string][] | undefined);
  if (cost === undefined || currentRedeemValue === undefined) {
    throw new Error("get_trade_amounts returned no values");
  }
  return { cost, currentRedeemValue };
}

/** Max payout of a binary leg = its share quantity (1 quote base-unit per share). */
export function binaryMaxPayout(quantity: bigint): bigint {
  return quantity;
}

async function devInspectU64s(
  build: (tx: Transaction) => void,
): Promise<bigint[]> {
  const tx = new Transaction();
  build(tx);
  const res = await suiClient().devInspectTransactionBlock({ sender: ZERO_SENDER, transactionBlock: tx });
  if (res.error) throw new Error(`devInspect failed: ${res.error}`);
  const last = res.results?.[res.results.length - 1];
  return decodeU64s(last?.returnValues as [number[], string][] | undefined);
}

/** predict::ask_bounds(&Predict, oracle_id) -> (min, max) per-share ask, 9-dec scale. */
export async function getAskBounds(oracleId: string): Promise<{ min: bigint; max: bigint }> {
  const [min, max] = await devInspectU64s((tx) => {
    tx.moveCall({
      target: target("predict", "ask_bounds"),
      arguments: [tx.object(config.predictObjectId), tx.pure.id(oracleId)],
    });
  });
  return { min: min ?? 0n, max: max ?? 0n };
}

/** predict::max_total_exposure_pct(&Predict) -> u64 (9-dec fraction, e.g. 800000000 = 80%). */
export async function getMaxExposurePct(): Promise<bigint> {
  const [v] = await devInspectU64s((tx) => {
    tx.moveCall({ target: target("predict", "max_total_exposure_pct"), arguments: [tx.object(config.predictObjectId)] });
  });
  return v ?? 0n;
}

/** predict::available_withdrawal(&Predict, &Clock) -> u64 (quote base units). */
export async function getAvailableWithdrawal(): Promise<bigint> {
  const [v] = await devInspectU64s((tx) => {
    tx.moveCall({
      target: target("predict", "available_withdrawal"),
      arguments: [tx.object(config.predictObjectId), tx.object(config.clockObjectId)],
    });
  });
  return v ?? 0n;
}

/** predict::trading_paused(&Predict) -> bool. */
export async function isTradingPaused(): Promise<boolean> {
  const tx = new Transaction();
  tx.moveCall({ target: target("predict", "trading_paused"), arguments: [tx.object(config.predictObjectId)] });
  const res = await suiClient().devInspectTransactionBlock({ sender: ZERO_SENDER, transactionBlock: tx });
  if (res.error) throw new Error(`trading_paused devInspect failed: ${res.error}`);
  const rv = res.results?.[res.results.length - 1]?.returnValues as [number[], string][] | undefined;
  if (!rv?.[0]) return false;
  return bcs.bool().parse(Uint8Array.from(rv[0][0]));
}

/** Read a PredictManager's binary position quantity for a (oracle, expiry, strike, isUp). */
export async function getManagerPosition(params: {
  managerId: string;
  oracleId: string;
  expiry: bigint;
  strike: bigint;
  isUp: boolean;
}): Promise<bigint> {
  const tx = new Transaction();
  const key = buildMarketKey(tx, params.oracleId, params.expiry, params.strike, params.isUp);
  tx.moveCall({
    target: target("predict_manager", "position"),
    arguments: [tx.object(params.managerId), key],
  });
  const res = await suiClient().devInspectTransactionBlock({
    sender: ZERO_SENDER,
    transactionBlock: tx,
  });
  if (res.error) throw new Error(`position devInspect failed: ${res.error}`);
  const last = res.results?.[res.results.length - 1];
  return decodeU64s(last?.returnValues as [number[], string][] | undefined)[0] ?? 0n;
}

/** Read manager quote balance via devInspect predict_manager::balance<T>. */
export async function getManagerBalance(managerId: string): Promise<bigint> {
  const tx = new Transaction();
  tx.moveCall({
    target: target("predict_manager", "balance"),
    typeArguments: [config.quoteAssetType],
    arguments: [tx.object(managerId)],
  });
  const res = await suiClient().devInspectTransactionBlock({
    sender: ZERO_SENDER,
    transactionBlock: tx,
  });
  if (res.error) throw new Error(`manager balance devInspect failed: ${res.error}`);
  const last = res.results?.[res.results.length - 1];
  return decodeU64s(last?.returnValues as [number[], string][] | undefined)[0] ?? 0n;
}

export type OracleState = {
  oracleId: string;
  underlying: string;
  status: OracleStatus;
  spotPrice: bigint;
  forwardPrice: bigint;
  expiry: bigint;
  settlementPrice: bigint | null;
};

/** Direct on-chain read of an OracleSVI object's fields (confirmation-critical freshness). */
export async function readOracleObject(oracleId: string): Promise<OracleState> {
  const obj = await suiClient().getObject({ id: oracleId, options: { showContent: true } });
  const content = obj.data?.content;
  if (!content || content.dataType !== "moveObject") {
    throw new Error(`oracle ${oracleId} not found or not a move object`);
  }
  const f = content.fields as Record<string, any>;
  // Derive status from expiry + settlement presence; refine with devInspect status() when needed.
  const settlement = extractSettlement(f);
  const expiry = BigInt(f.expiry ?? 0);
  const now = BigInt(Date.now());
  let status: OracleStatus;
  if (settlement !== null) status = "SETTLED";
  else if (f.is_active === false) status = "INACTIVE";
  else if (now >= expiry) status = "PENDING_SETTLEMENT";
  else status = "ACTIVE";
  return {
    oracleId,
    underlying: extractUnderlying(f),
    status,
    spotPrice: extractSpot(f),
    forwardPrice: BigInt(f.forward_price ?? f.forward ?? 0),
    expiry,
    settlementPrice: settlement,
  };
}

function extractUnderlying(f: Record<string, any>): string {
  const u = f.underlying_asset;
  if (typeof u === "string") return u;
  if (u && typeof u === "object" && "fields" in u) return String((u.fields as any).name ?? "");
  return String(u ?? "");
}
function extractSpot(f: Record<string, any>): bigint {
  if (f.spot_price !== undefined) return BigInt(f.spot_price);
  const prices = f.prices?.fields ?? f.prices;
  if (prices?.spot !== undefined) return BigInt(prices.spot);
  return 0n;
}
function extractSettlement(f: Record<string, any>): bigint | null {
  const s = f.settlement_price;
  if (s === null || s === undefined) return null;
  if (typeof s === "object" && "fields" in s) {
    const inner = (s.fields as any).vec ?? (s.fields as any);
    if (Array.isArray(inner) && inner.length > 0) return BigInt(inner[0]);
    return null;
  }
  return BigInt(s);
}

export { STATUS_BY_CODE };
