/** Shared API DTO types for the Keel frontend. */

export type ManagerResp = {
  managerId: string | null;
  needsCreation: boolean;
  creationTxBytes: string | null;
};

export type Holding = {
  assetSymbol: string;
  coinType: string;
  rawBalance: string;
  uiBalance: number;
  usdValue: number;
  insurable: boolean;
  oracleId: string | null;
};

export type HoldingsResp = { holdings: Holding[]; totalUsdValue: number };

export type Oracle = {
  oracleId: string;
  underlying: string;
  status: string;
  spotPrice: number;
  forwardPrice: number;
  expiryTimestamp: number;
  settlementPrice: number | null;
  minStrike: number;
  tickSize: number;
  protectDownTo: number | null;
  isStale: boolean;
  source: string;
};

export type OracleStateResp = { oracles: Oracle[] };

export type Leg = {
  legIndex: number;
  type: string;
  oracleId: string;
  expiry: string;
  strike: string;
  isUp: boolean;
  quantity: string;
};

export type PerLeg = {
  legIndex: number;
  strike: number;
  quantity: number;
  premium: number;
  maxPayout: number;
  perShareAsk: number;
  mintable: boolean;
};

export type QuoteResp = {
  oracleId: string;
  legs: Leg[];
  perLeg: PerLeg[];
  snappedTriggerPrice: number;
  snappedFloorPrice: number;
  totalPremium: string;
  totalMaxPayout: string;
  premiumPctOfCoverage: number;
  expiryTimestamp: number;
  exposureCheck: { withinVaultCapacity: boolean; maxFundablePayout: number; note: string };
  warnings: string[];
  quoteValidUntil: number;
  sizingMethod: string;
};

export type BuildMintResp = {
  unsignedTxBytes: string;
  depositAmount: number;
  summary: {
    asset: string;
    sumInsured: number;
    premium: number;
    triggerPrice: number;
    floorPrice: number;
    expiry: number;
    legCount: number;
  };
};

export type ConfirmMintResp = { policyId: string; status: string };

export type PolicyLeg = { strike: number; quantity: string; onChainQuantity: string };

export type PolicyDto = {
  policyId: string;
  asset: string;
  sumInsured: number;
  triggerPrice: number;
  premiumPaid: number;
  status: string;
  expiryTimestamp: number;
  legs: PolicyLeg[];
  liveOracle: { spotPrice: number; status: string; timeToExpirySeconds: number } | null;
  payoutAmount: number | null;
  mintTxDigest: string | null;
  redeemTxDigest: string | null;
  explanation: string;
};

export type PoliciesResp = { policies: PolicyDto[] };

export type StatsResp = {
  totalValueProtected: number;
  activePoliciesCount: number;
  totalPremiumsPaidAllTime: number;
  vaultAvailableWithdrawal: number;
};

export type VaultResp = {
  vaultValue: number;
  vaultBalance: number;
  totalMtm: number;
  totalMaxPayout: number;
  availableWithdrawal: number | null; // null when limiter disabled (=unlimited)
  availableLiquidity: number;
  plpTotalSupply: number;
  plpSharePrice: number;
  utilizationPct: number;
  limiterEnabled: boolean;
  note: string;
};

export type LpPositionResp = {
  plpBalance: string;
  plpUiBalance: number;
  currentValueUsd: number;
  totalSupplied: number;
  totalWithdrawn: number;
  unrealizedPnl: number;
  sharePrice: number;
  firstSupplyAt: number | null;
};

export type LpHistoryEvent = {
  type: "supply" | "withdraw";
  amount: number;
  shares: number;
  timestamp: number;
  txDigest: string;
};
export type LpHistoryResp = { events: LpHistoryEvent[] };

export type CancelResp = { supported: false; reason: string };

export type LpSupplyResp = { unsignedTxBytes: string; amount: number };

export type LpWithdrawResp =
  | { unsignedTxBytes: string; plpAmount: number; blocked?: false }
  | { blocked: true; maxWithdrawableNow: number };

export type FaucetResp = { txDigest: string; dusdc: number; sui: number };
