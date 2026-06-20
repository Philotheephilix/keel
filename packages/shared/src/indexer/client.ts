/**
 * Typed wrappers over the public Predict indexer. Used for list/render freshness
 * (a few seconds stale is fine). Confirmation-critical reads use on-chain reads.
 */
import { config } from "../config.js";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${config.indexerUrl}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`indexer ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export type IndexerOracle = {
  predict_id: string;
  oracle_id: string;
  oracle_cap_id: string;
  underlying_asset: string;
  expiry: number;
  min_strike: number;
  tick_size: number;
  status: string; // "active" | "settled" | ...
  activated_at: number | null;
  settlement_price: number | null;
  settled_at: number | null;
};

export type IndexerManager = {
  manager_id: string;
  owner: string;
  digest?: string;
  checkpoint_timestamp_ms?: number;
};

export type IndexerOracleState = {
  oracle: IndexerOracle;
  latest_price: { spot: number; forward: number; checkpoint_timestamp_ms: number } | null;
};

export function getAllOracles(): Promise<IndexerOracle[]> {
  return get<IndexerOracle[]>("/oracles");
}

export function getOracleStateIndexed(oracleId: string): Promise<IndexerOracleState> {
  return get<IndexerOracleState>(`/oracles/${oracleId}/state`);
}

export async function getManagersByOwner(owner: string): Promise<IndexerManager[]> {
  const all = await get<IndexerManager[]>(`/managers?owner=${owner}`);
  // /managers may return events for all owners; filter to the requested one.
  return all.filter((m) => m.owner?.toLowerCase() === owner.toLowerCase());
}

export type IndexerVaultSummary = {
  vault_balance: number;
  vault_value: number;
  total_mtm: number;
  total_max_payout: number;
  available_liquidity: number;
  available_withdrawal: number;
  plp_total_supply: number;
  plp_share_price: number;
  utilization: number;
  max_payout_utilization: number;
  total_supplied: number;
  total_withdrawn: number;
};

export function getVaultSummaryIndexed(predictId: string): Promise<IndexerVaultSummary> {
  return get<IndexerVaultSummary>(`/predicts/${predictId}/vault/summary`);
}

export type IndexerLpEvent = {
  digest: string;
  supplier?: string;
  sender?: string;
  amount: number;
  shares_minted?: number;
  shares_burned?: number;
  checkpoint_timestamp_ms: number;
};

export async function getLpSupplies(owner: string): Promise<IndexerLpEvent[]> {
  const all = await get<IndexerLpEvent[]>(`/lp/supplies?owner=${owner}`);
  return all.filter((e) => (e.supplier ?? e.sender ?? "").toLowerCase() === owner.toLowerCase());
}

export async function getLpWithdrawals(owner: string): Promise<IndexerLpEvent[]> {
  const all = await get<IndexerLpEvent[]>(`/lp/withdrawals?owner=${owner}`);
  return all.filter((e) => (e.supplier ?? e.sender ?? "").toLowerCase() === owner.toLowerCase());
}
