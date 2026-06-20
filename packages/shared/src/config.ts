/**
 * Central runtime configuration for Keel, sourced from environment.
 * Single source of truth for chain IDs, type strings, and decimals.
 * Throws early if a required value is missing so we never silently
 * call the wrong package on testnet.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

export const config = {
  network: optional("SUI_NETWORK", "testnet"),
  rpcUrl: optional("SUI_RPC_URL", "https://fullnode.testnet.sui.io:443"),

  predictPackageId: required("PREDICT_PACKAGE_ID"),
  predictObjectId: required("PREDICT_SHARED_OBJECT_ID"),
  registryId: process.env.PREDICT_REGISTRY_ID || null,
  indexerUrl: optional("PREDICT_INDEXER_URL", "https://predict-server.testnet.mystenlabs.com"),

  quoteAssetType: required("QUOTE_ASSET_TYPE"),
  plpCoinType: required("PLP_COIN_TYPE"),

  clockObjectId: optional("SUI_CLOCK_OBJECT_ID", "0x6"),

  /** Oracle prices and strikes are fixed-point with this many decimals. */
  oraclePriceDecimals: Number(optional("ORACLE_PRICE_DECIMALS", "9")),
  /** Quote asset (dUSDC) decimals. */
  quoteDecimals: Number(optional("QUOTE_DECIMALS", "6")),
} as const;

/** Keeper-only: private key for signing redeem_permissionless. Not loaded in web. */
export function keeperPrivateKey(): string {
  return required("KEEPER_PRIVATE_KEY");
}

/** Fully-qualified Move target helper. */
export function target(module: string, fn: string): `${string}::${string}::${string}` {
  return `${config.predictPackageId}::${module}::${fn}`;
}

export const PRICE_SCALE = 10 ** config.oraclePriceDecimals;
export const QUOTE_SCALE = 10 ** config.quoteDecimals;
