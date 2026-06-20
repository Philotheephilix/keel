/** keel.getOracleState + insurable-oracle listing. */
import { config, PRICE_SCALE } from "../config.js";
import { readOracleObject, getBinaryTradeAmounts, getAskBounds, type OracleStatus } from "../sui/reads.js";
import { getAllOracles, getOracleStateIndexed, type IndexerOracle } from "../indexer/client.js";

const STALE_SPOT_MS = 30_000;

export type OracleStateDto = {
  oracleId: string;
  underlying: string;
  status: OracleStatus;
  spotPrice: number; // human
  forwardPrice: number;
  expiryTimestamp: number;
  settlementPrice: number | null;
  minStrike: number;
  tickSize: number;
  /** Lowest price you can protect down to on this market (deepest tradeable strike). */
  protectDownTo: number | null;
  isStale: boolean;
  source: "onchain" | "indexer";
};

function normalizeStatus(s: string): OracleStatus {
  switch (s.toLowerCase()) {
    case "active": return "ACTIVE";
    case "settled": return "SETTLED";
    case "pending_settlement": return "PENDING_SETTLEMENT";
    default: return "INACTIVE";
  }
}

/** Minimum remaining time before expiry for an oracle to be sellable as cover. */
const MIN_HORIZON_MS = 60_000;

/**
 * List oracles Keel can offer cover on. The indexer `status` field lags expiry, so we
 * additionally require the expiry to be comfortably in the future — an oracle past
 * expiry is PENDING_SETTLEMENT on-chain even if the indexer still says "active".
 */
// The depth search is RPC-heavy; depth barely moves minute-to-minute, so cache it long.
let _listCache: { data: OracleStateDto[]; ts: number } | null = null;
const LIST_TTL_MS = 5 * 60_000;

/**
 * Binary-search the lowest strike still tradeable as a down-bet (deepest protection).
 * The protocol aborts pricing below its min ask, so an abort == too deep == go higher.
 */
/** A Move pricing abort means "not mintable"; anything else is an RPC/transport error. */
function isPricingAbort(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /MoveAbort|abort|pricing_config|assert_mintable|quote_spread/i.test(m);
}

/**
 * Binary-search the lowest strike still tradeable as a down-bet (deepest protection).
 * Accurate because it uses the protocol's real (skewed) pricing. The retrying transport
 * absorbs throttling; this runs in the BACKGROUND so it never blocks the list response.
 */
async function deepestProtectDownTo(
  oracleId: string,
  expiry: bigint,
  spotHuman: number,
  minStrikeBase: bigint,
  tickBase: bigint,
  minAsk: number,
): Promise<number | null> {
  const qty = 1_000_000n;
  const snap = (b: bigint): bigint => {
    if (b <= minStrikeBase || tickBase <= 0n) return minStrikeBase;
    const steps = (b - minStrikeBase + tickBase / 2n) / tickBase;
    return minStrikeBase + steps * tickBase;
  };
  const mintable = async (strikeBase: bigint): Promise<boolean> => {
    try {
      const { cost } = await getBinaryTradeAmounts({ oracleId, expiry, strike: strikeBase, isUp: false, quantity: qty });
      return Number(cost) / Number(qty) >= minAsk;
    } catch (e) {
      if (isPricingAbort(e)) return false;
      throw e; // RPC error → bubble up so this oracle reports unknown (null), not false
    }
  };
  let hi = snap(BigInt(Math.round(spotHuman)) * BigInt(PRICE_SCALE));
  if (!(await mintable(hi))) return null;
  let lo = minStrikeBase;
  for (let i = 0; i < 5; i++) {
    const mid = snap((lo + hi) / 2n);
    if (mid <= lo || mid >= hi) break;
    if (await mintable(mid)) hi = mid;
    else lo = mid;
  }
  return Number(hi) / PRICE_SCALE;
}

/** Run async fn over items with bounded concurrency to avoid RPC bursts. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// depth keyed by oracleId, computed in the background and merged into list responses.
const _depthCache = new Map<string, number | null>();
let _depthComputedAt = 0;
let _depthComputing = false;

async function buildBaseList(): Promise<OracleStateDto[]> {
  const now = Date.now();
  const oracles = await getAllOracles();
  const list = oracles
    .filter((o) => o.predict_id === config.predictObjectId)
    .filter((o) => o.status.toLowerCase() === "active")
    .filter((o) => o.expiry > now + MIN_HORIZON_MS)
    .map((o) => fromIndexer(o))
    .sort((a, b) => a.expiryTimestamp - b.expiryTimestamp);

  // The /oracles list endpoint has no spot. All oracles on the same underlying share
  // the same spot, so fetch one live state per underlying and fan it out (cheap).
  const underlyings = [...new Set(list.map((o) => o.underlying))];
  const spots = new Map<string, number>();
  await Promise.all(
    underlyings.map(async (u) => {
      const rep = list.find((o) => o.underlying === u)!;
      const state = await getOracleStateIndexed(rep.oracleId).catch(() => null);
      if (state?.latest_price?.spot) spots.set(u, state.latest_price.spot / PRICE_SCALE);
    }),
  );
  for (const o of list) {
    const s = spots.get(o.underlying);
    if (s) o.spotPrice = s;
  }
  return list;
}

/** Background depth computation — never awaited by a request; fills _depthCache. */
function computeDepthInBackground(list: OracleStateDto[]): void {
  if (_depthComputing || Date.now() - _depthComputedAt < LIST_TTL_MS) return;
  _depthComputing = true;
  (async () => {
    try {
      const bounds = await getAskBounds(list[0]?.oracleId ?? config.predictObjectId).catch(() => null);
      const minAsk = bounds ? Number(bounds.min) / PRICE_SCALE : 0.01;
      await mapLimit(
        list.filter((o) => o.spotPrice > 0),
        3,
        async (o) => {
          const v = await deepestProtectDownTo(
            o.oracleId,
            BigInt(o.expiryTimestamp),
            o.spotPrice,
            BigInt(Math.round(o.minStrike * PRICE_SCALE)),
            BigInt(Math.round(o.tickSize * PRICE_SCALE)),
            minAsk,
          ).catch(() => null);
          if (v !== null) _depthCache.set(o.oracleId, v);
        },
      );
      _depthComputedAt = Date.now();
    } finally {
      _depthComputing = false;
    }
  })();
}

export async function listInsurableOracles(): Promise<OracleStateDto[]> {
  let list: OracleStateDto[];
  if (_listCache && Date.now() - _listCache.ts < 10_000) {
    list = _listCache.data;
  } else {
    list = await buildBaseList();
    _listCache = { data: list, ts: Date.now() };
  }
  // merge any depth we've already computed; kick off (background) computation otherwise.
  for (const o of list) {
    const d = _depthCache.get(o.oracleId);
    if (d !== undefined) o.protectDownTo = d;
  }
  computeDepthInBackground(list);
  return list;
}

function fromIndexer(o: IndexerOracle, spot?: number, forward?: number): OracleStateDto {
  return {
    oracleId: o.oracle_id,
    underlying: o.underlying_asset,
    status: normalizeStatus(o.status),
    spotPrice: (spot ?? 0) / PRICE_SCALE,
    forwardPrice: (forward ?? 0) / PRICE_SCALE,
    expiryTimestamp: o.expiry,
    settlementPrice: o.settlement_price !== null ? o.settlement_price / PRICE_SCALE : null,
    minStrike: o.min_strike / PRICE_SCALE,
    tickSize: o.tick_size / PRICE_SCALE,
    protectDownTo: null,
    isStale: false,
    source: "indexer",
  };
}

/**
 * keel.getOracleState — indexer for normal render; force on-chain read when freshness
 * is confirmation-critical (right before signing a mint).
 */
export async function getOracleState(
  oracleId: string,
  opts: { forceFresh?: boolean } = {},
): Promise<OracleStateDto> {
  const indexed = await getOracleStateIndexed(oracleId).catch(() => null);
  if (opts.forceFresh || !indexed) {
    const live = await readOracleObject(oracleId);
    const meta = indexed?.oracle ?? (await getAllOracles()).find((o) => o.oracle_id === oracleId);
    return {
      oracleId,
      underlying: live.underlying,
      status: live.status,
      spotPrice: Number(live.spotPrice) / PRICE_SCALE,
      forwardPrice: Number(live.forwardPrice) / PRICE_SCALE,
      expiryTimestamp: Number(live.expiry),
      settlementPrice: live.settlementPrice !== null ? Number(live.settlementPrice) / PRICE_SCALE : null,
      minStrike: meta ? meta.min_strike / PRICE_SCALE : 0,
      tickSize: meta ? meta.tick_size / PRICE_SCALE : 0,
      protectDownTo: null,
      isStale: false,
      source: "onchain",
    };
  }
  const dto = fromIndexer(indexed.oracle, indexed.latest_price?.spot, indexed.latest_price?.forward);
  const ts = indexed.latest_price?.checkpoint_timestamp_ms ?? 0;
  dto.isStale = ts > 0 && Date.now() - ts > STALE_SPOT_MS;
  return dto;
}

/** Oracle grid (base units) for the indemnity mapper. */
export async function getOracleGrid(oracleId: string): Promise<{ minStrike: bigint; tickSize: bigint; expiry: bigint }> {
  const o = (await getAllOracles()).find((x) => x.oracle_id === oracleId);
  if (!o) throw new Error(`oracle ${oracleId} not found in indexer`);
  return {
    minStrike: BigInt(o.min_strike),
    tickSize: BigInt(o.tick_size),
    expiry: BigInt(o.expiry),
  };
}
