/**
 * Indemnity engine — maps a plain cover request to a ladder of binary down-legs.
 *
 * Why binary ladder (not range ladder): redeem_permissionless is MarketKey-only, so
 * every leg must be a binary to keep the keeper's auto-payout working (see docs/05).
 *
 * Model: a down-binary at strike K pays 1 quote base-unit per share if settle < K.
 * Place `rungs` strikes evenly across [floor, trigger], each with equal max payout
 * sumInsured/rungs. As price falls past each strike, one more rung pays — the cumulative
 * payout staircase approximates a linear loss S*(trigger-price)/(trigger-floor), capped at S.
 *
 * Pricing is NEVER computed here — this only sizes quantities/strikes. Premium comes
 * from live predict::get_trade_amounts in the quote step.
 */
import { PRICE_SCALE, QUOTE_SCALE } from "../config.js";
import type { Leg } from "../types/index.js";

export type OracleGrid = {
  minStrike: bigint; // 9-dec base units
  tickSize: bigint; // 9-dec base units
  expiry: bigint; // ms
};

export type MappingResult = {
  legs: Leg[];
  snappedTriggerPrice: number; // human units after snapping to grid
  snappedFloorPrice: number;
  sizingMethod: "binary_ladder";
  warnings: string[];
};

const DEFAULT_RUNGS = 6;
const DEFAULT_BAND_PCT = 0.15; // floor = trigger - 15% if not given

/** Snap a human price to the nearest valid strike on the oracle grid. Returns base units. */
export function snapToGrid(humanPrice: number, grid: OracleGrid): bigint {
  const priceBase = BigInt(Math.round(humanPrice * PRICE_SCALE));
  if (priceBase <= grid.minStrike) return grid.minStrike;
  const steps = (priceBase - grid.minStrike + grid.tickSize / 2n) / grid.tickSize;
  return grid.minStrike + steps * grid.tickSize;
}

function baseToHuman(base: bigint): number {
  return Number(base) / PRICE_SCALE;
}

export function mapCoverageToLadder(params: {
  oracleId: string;
  sumInsured: number; // dUSDC human
  triggerPrice: number; // human
  floorPrice?: number; // human
  rungs?: number;
  grid: OracleGrid;
}): MappingResult {
  const warnings: string[] = [];
  const rungs = params.rungs ?? DEFAULT_RUNGS;
  const grid = params.grid;

  const requestedTrigger = params.triggerPrice;
  const triggerBase = snapToGrid(requestedTrigger, grid);
  const snappedTrigger = baseToHuman(triggerBase);
  if (Math.abs(snappedTrigger - requestedTrigger) > 1e-9) {
    warnings.push(
      `Trigger snapped from $${requestedTrigger.toLocaleString()} to $${snappedTrigger.toLocaleString()} (nearest available strike).`,
    );
  }

  const requestedFloor = params.floorPrice ?? snappedTrigger * (1 - DEFAULT_BAND_PCT);
  let floorBase = snapToGrid(requestedFloor, grid);
  if (floorBase >= triggerBase) {
    // floor must be strictly below trigger; step down one tick
    floorBase = triggerBase > grid.tickSize ? triggerBase - grid.tickSize : grid.minStrike;
    warnings.push("Floor was at/above trigger; clamped to one tick below trigger.");
  }
  const snappedFloor = baseToHuman(floorBase);

  // Distribute `rungs` strikes evenly across [floor, trigger], snapped to grid, deduped.
  const span = triggerBase - floorBase;
  const strikeSet = new Set<bigint>();
  for (let i = 0; i < rungs; i++) {
    // i=0 -> floor ... i=rungs-1 -> trigger (top rung just at/below trigger)
    const frac = rungs === 1 ? 0 : i / (rungs - 1);
    const raw = floorBase + BigInt(Math.round(Number(span) * frac));
    strikeSet.add(snapToGrid(baseToHuman(raw), grid));
  }
  const strikes = [...strikeSet].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (strikes.length < rungs) {
    warnings.push(
      `Strike grid too coarse for ${rungs} rungs; using ${strikes.length} distinct strikes.`,
    );
  }

  // Equal max-payout increment per rung. quantity == max payout (quote base units).
  const perRungPayout = BigInt(Math.floor((params.sumInsured * QUOTE_SCALE) / strikes.length));
  const legs: Leg[] = strikes.map((strike, idx) => ({
    legIndex: idx,
    type: "binary",
    oracleId: params.oracleId,
    expiry: grid.expiry.toString(),
    strike: strike.toString(),
    isUp: false,
    quantity: perRungPayout.toString(),
  }));

  return {
    legs,
    snappedTriggerPrice: snappedTrigger,
    snappedFloorPrice: snappedFloor,
    sizingMethod: "binary_ladder",
    warnings,
  };
}

/**
 * Compute the cumulative payout the ladder delivers at a given settlement price —
 * used by tests to assert linear-loss approximation, and by the UI explanation.
 */
export function ladderPayoutAt(settlementHuman: number, legs: Leg[]): bigint {
  const settleBase = BigInt(Math.round(settlementHuman * PRICE_SCALE));
  let total = 0n;
  for (const leg of legs) {
    if (settleBase < BigInt(leg.strike)) total += BigInt(leg.quantity); // in the money
  }
  return total; // quote base units
}
