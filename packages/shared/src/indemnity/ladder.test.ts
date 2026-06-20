import { describe, it, expect } from "vitest";
import { mapCoverageToLadder, ladderPayoutAt, snapToGrid, type OracleGrid } from "./ladder.js";
import { PRICE_SCALE, QUOTE_SCALE } from "../config.js";

// Grid mirroring the live BTC oracle: min 50000, tick 1, 9-dec.
const grid: OracleGrid = {
  minStrike: BigInt(50000) * BigInt(PRICE_SCALE),
  tickSize: BigInt(1) * BigInt(PRICE_SCALE),
  expiry: 1781955000000n,
};

describe("snapToGrid", () => {
  it("snaps to nearest tick", () => {
    expect(snapToGrid(60000.4, grid)).toBe(BigInt(60000) * BigInt(PRICE_SCALE));
    expect(snapToGrid(60000.6, grid)).toBe(BigInt(60001) * BigInt(PRICE_SCALE));
  });
  it("clamps below min strike", () => {
    expect(snapToGrid(10, grid)).toBe(grid.minStrike);
  });
});

describe("mapCoverageToLadder", () => {
  const base = { oracleId: "0xabc", sumInsured: 600, triggerPrice: 60000, grid };

  it("produces the requested number of distinct down-binary legs", () => {
    const r = mapCoverageToLadder({ ...base, rungs: 6 });
    expect(r.legs).toHaveLength(6);
    expect(r.legs.every((l) => l.type === "binary" && l.isUp === false)).toBe(true);
    expect(r.sizingMethod).toBe("binary_ladder");
  });

  it("total max payout equals sumInsured (within rounding)", () => {
    const r = mapCoverageToLadder({ ...base, rungs: 6 });
    const totalPayout = r.legs.reduce((s, l) => s + BigInt(l.quantity), 0n);
    const target = BigInt(base.sumInsured) * BigInt(QUOTE_SCALE);
    // within one rung's rounding
    const diff = target - totalPayout;
    expect(diff >= 0n && diff <= BigInt(r.legs.length)).toBe(true);
  });

  it("strikes lie within [floor, trigger] and ascend", () => {
    const r = mapCoverageToLadder({ ...base, rungs: 6 });
    const strikes = r.legs.map((l) => BigInt(l.strike));
    const triggerBase = BigInt(Math.round(r.snappedTriggerPrice * PRICE_SCALE));
    const floorBase = BigInt(Math.round(r.snappedFloorPrice * PRICE_SCALE));
    for (let i = 1; i < strikes.length; i++) expect(strikes[i]! > strikes[i - 1]!).toBe(true);
    expect(strikes[0]! >= floorBase).toBe(true);
    expect(strikes[strikes.length - 1]! <= triggerBase).toBe(true);
  });

  it("approximates a linear loss curve across synthetic settlement prices", () => {
    const r = mapCoverageToLadder({ ...base, triggerPrice: 60000, floorPrice: 51000, rungs: 10 });
    const S = base.sumInsured * QUOTE_SCALE;
    const T = r.snappedTriggerPrice;
    const F = r.snappedFloorPrice;
    // Sample prices across the band; payout should track S*(T-p)/(T-F), within one rung increment.
    const tolerance = S / r.legs.length + QUOTE_SCALE; // one rung + 1 dUSDC slack
    for (let p = F - 500; p <= T + 500; p += 250) {
      const actual = Number(ladderPayoutAt(p, r.legs));
      const expected = Math.max(0, Math.min(S, (S * (T - p)) / (T - F)));
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
    }
  });

  it("pays zero above trigger and full below floor", () => {
    const r = mapCoverageToLadder({ ...base, triggerPrice: 60000, floorPrice: 51000, rungs: 8 });
    expect(ladderPayoutAt(r.snappedTriggerPrice + 100, r.legs)).toBe(0n);
    const full = r.legs.reduce((s, l) => s + BigInt(l.quantity), 0n);
    expect(ladderPayoutAt(r.snappedFloorPrice - 100, r.legs)).toBe(full);
  });

  it("warns when trigger is snapped", () => {
    const r = mapCoverageToLadder({ ...base, triggerPrice: 60000.7, rungs: 4 });
    expect(r.warnings.some((w) => w.includes("snapped"))).toBe(true);
  });
});
