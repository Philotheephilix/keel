/**
 * keel.getHoldings — proof-of-exposure. Reads real on-chain balances and marks which
 * are insurable. v1 testnet reality: no Sui-native wrapped BTC exists, so the insurable
 * collateral asset is dUSDC (what the user provably holds), with BTC as the reference
 * underlying priced from the live oracle (see docs/05 Q4). Allowlist is config-driven.
 */
import { config, QUOTE_SCALE } from "../config.js";
import { suiClient } from "../sui/client.js";
import { listInsurableOracles } from "./oracle.js";

export type Holding = {
  assetSymbol: string;
  coinType: string;
  rawBalance: string;
  uiBalance: number;
  usdValue: number;
  insurable: boolean;
  oracleId: string | null;
};

export type HoldingsResult = {
  holdings: Holding[];
  totalUsdValue: number;
};

/** Asset allowlist: coinType -> {symbol, decimals, referenceUnderlying}. Config-driven. */
const ALLOWLIST: Record<string, { symbol: string; decimals: number; underlying: string }> = {
  [config.quoteAssetType]: { symbol: "dUSDC", decimals: config.quoteDecimals, underlying: "BTC" },
};

export async function getHoldings(userAddress: string): Promise<HoldingsResult> {
  const balances = await suiClient().getAllBalances({ owner: userAddress });
  const oracles = await listInsurableOracles();
  const btcOracle = oracles.find((o) => o.underlying === "BTC" && o.status === "ACTIVE") ?? null;

  const holdings: Holding[] = [];
  let total = 0;
  for (const b of balances) {
    if (BigInt(b.totalBalance) <= 0n) continue;
    const meta = ALLOWLIST[b.coinType];
    if (!meta) continue; // not in allowlist — skip (kept simple; could show as non-insurable)
    const ui = Number(b.totalBalance) / 10 ** meta.decimals;
    // dUSDC is a stable, so usdValue == ui balance. (Reference underlying BTC priced separately.)
    const usdValue = meta.symbol === "dUSDC" ? ui : ui;
    const insurable = !!btcOracle;
    holdings.push({
      assetSymbol: meta.symbol,
      coinType: b.coinType,
      rawBalance: b.totalBalance,
      uiBalance: ui,
      usdValue,
      insurable,
      oracleId: insurable ? btcOracle!.oracleId : null,
    });
    total += usdValue;
  }
  return { holdings, totalUsdValue: total };
}

/** Convenience: the maximum dUSDC the user can commit as premium (raw balance). */
export async function getQuoteAssetBalance(userAddress: string): Promise<bigint> {
  const b = await suiClient().getBalance({ owner: userAddress, coinType: config.quoteAssetType });
  return BigInt(b.totalBalance);
}

export { QUOTE_SCALE };
