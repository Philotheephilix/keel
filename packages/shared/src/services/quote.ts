/**
 * keel.mapCoverageToPositions + keel.getQuote.
 *
 * Premiums are NEVER computed here — every leg is priced by the live protocol read
 * predict::get_trade_amounts. This layer maps the request to a binary ladder, prices
 * each leg, drops legs outside the protocol's ask bounds (which would abort mint),
 * and checks vault exposure headroom.
 */
import { PRICE_SCALE, QUOTE_SCALE } from "../config.js";
import { mapCoverageToLadder } from "../indemnity/ladder.js";
import { getBinaryTradeAmounts, getAskBounds, isTradingPaused } from "../sui/reads.js";
import { getOracleGrid, getOracleState } from "./oracle.js";
import { getVaultSummary } from "./lp.js";
import type { CoverRequest, Leg } from "../types/index.js";

export type QuoteLegDto = {
  legIndex: number;
  strike: number; // human
  quantity: string;
  premium: string; // dUSDC base units
  maxPayout: string; // dUSDC base units (== quantity)
  perShareAsk: number; // 0..1
  mintable: boolean;
};

export type QuoteResult = {
  oracleId: string;
  legs: Leg[]; // mintable legs only (what buildMint will use)
  perLeg: QuoteLegDto[];
  snappedTriggerPrice: number;
  snappedFloorPrice: number;
  totalPremium: string; // base units
  totalMaxPayout: string; // base units
  premiumPctOfCoverage: number;
  expiryTimestamp: number;
  exposureCheck: { withinVaultCapacity: boolean; maxFundablePayout: number; note: string };
  warnings: string[];
  quoteValidUntil: number;
  sizingMethod: "binary_ladder";
};

const QUOTE_TTL_MS = 8_000;

export async function quoteCover(req: CoverRequest): Promise<QuoteResult> {
  const oracle = await getOracleState(req.oracleId, { forceFresh: true });
  if (oracle.status !== "ACTIVE") {
    throw new KeelError("MARKET_CLOSED", `Market not tradeable (status ${oracle.status}).`);
  }
  if (await isTradingPaused()) {
    throw new KeelError("TRADING_PAUSED", "Trading is paused on the protocol.");
  }

  const grid = await getOracleGrid(req.oracleId);
  const mapping = mapCoverageToLadder({
    oracleId: req.oracleId,
    sumInsured: req.sumInsured,
    triggerPrice: req.triggerPrice,
    floorPrice: req.floorPrice,
    rungs: req.rungs,
    grid,
  });
  const warnings = [...mapping.warnings];

  const bounds = await getAskBounds(req.oracleId);

  // Price every leg in parallel (each is one get_trade_amounts devInspect round-trip).
  const priced = await Promise.all(
    mapping.legs.map(async (leg) => {
      const qty = BigInt(leg.quantity);
      const { cost } = await getBinaryTradeAmounts({
        oracleId: req.oracleId,
        expiry: BigInt(leg.expiry),
        strike: BigInt(leg.strike),
        isUp: false,
        quantity: qty,
      });
      const askScaled = qty > 0n ? (cost * BigInt(PRICE_SCALE)) / qty : 0n;
      const mintable = askScaled >= bounds.min && askScaled <= bounds.max;
      return { leg, qty, cost, askScaled, mintable };
    }),
  );

  const perLeg: QuoteLegDto[] = [];
  const mintableLegs: Leg[] = [];
  let totalPremium = 0n;
  let totalPayout = 0n;
  for (const { leg, qty, cost, askScaled, mintable } of priced) {
    perLeg.push({
      legIndex: leg.legIndex,
      strike: Number(leg.strike) / PRICE_SCALE,
      quantity: leg.quantity,
      premium: cost.toString(),
      maxPayout: leg.quantity,
      perShareAsk: Number(askScaled) / PRICE_SCALE,
      mintable,
    });
    if (mintable) {
      mintableLegs.push({ ...leg, legIndex: mintableLegs.length });
      totalPremium += cost;
      totalPayout += qty;
    }
  }

  if (mintableLegs.length < mapping.legs.length) {
    warnings.push(
      `${mapping.legs.length - mintableLegs.length} of ${mapping.legs.length} ladder rungs fell outside the market's price bounds and were dropped; effective coverage is $${(Number(totalPayout) / QUOTE_SCALE).toFixed(2)}.`,
    );
  }
  if (mintableLegs.length === 0) {
    throw new KeelError(
      "NO_MINTABLE_LEGS",
      "No part of this cover is currently mintable (strikes too far out-of-the-money for this expiry). Try a trigger closer to spot or a longer-dated market.",
    );
  }

  // exposure headroom: a mint whose max payout exceeds the vault's available liquidity
  // will abort on-chain. Check it against the live vault summary and surface a real cap.
  const vault = await getVaultSummary().catch(() => null);
  const newMaxPayoutUi = Number(totalPayout) / QUOTE_SCALE;
  const headroom = vault?.availableLiquidity ?? Number.POSITIVE_INFINITY;
  const within = newMaxPayoutUi <= headroom;
  const exposureCheck = {
    withinVaultCapacity: within,
    maxFundablePayout: within ? newMaxPayoutUi : headroom,
    note: within
      ? `Within vault capacity (available liquidity $${headroom.toLocaleString()}).`
      : `Vault near capacity: only $${headroom.toLocaleString()} of payout can currently be funded.`,
  };

  const premiumPct =
    totalPayout > 0n ? (Number(totalPremium) / Number(totalPayout)) * 100 : 0;

  return {
    oracleId: req.oracleId,
    legs: mintableLegs,
    perLeg,
    snappedTriggerPrice: mapping.snappedTriggerPrice,
    snappedFloorPrice: mapping.snappedFloorPrice,
    totalPremium: totalPremium.toString(),
    totalMaxPayout: totalPayout.toString(),
    premiumPctOfCoverage: premiumPct,
    expiryTimestamp: oracle.expiryTimestamp,
    exposureCheck,
    warnings,
    quoteValidUntil: Date.now() + QUOTE_TTL_MS,
    sizingMethod: "binary_ladder",
  };
}

export class KeelError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "KeelError";
  }
}
