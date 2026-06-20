/** keel.getProtocolStats — landing/dashboard banner. Non-critical, cacheable. */
import { prisma, PolicyStatus } from "../db/client.js";
import { getVaultSummary } from "./lp.js";

export type ProtocolStats = {
  totalValueProtected: number;
  activePoliciesCount: number;
  totalPremiumsPaidAllTime: number;
  vaultAvailableWithdrawal: number;
};

export async function getProtocolStats(): Promise<ProtocolStats> {
  const [active, allPolicies, vault] = await Promise.all([
    prisma.keelPolicy.findMany({ where: { status: PolicyStatus.ACTIVE } }),
    prisma.keelPolicy.findMany({}),
    getVaultSummary().catch(() => ({ availableWithdrawal: 0, note: "" })),
  ]);
  return {
    totalValueProtected: active.reduce((s, p) => s + p.sumInsured, 0),
    activePoliciesCount: active.length,
    totalPremiumsPaidAllTime: allPolicies.reduce((s, p) => s + p.premiumPaid, 0),
    vaultAvailableWithdrawal: vault.availableWithdrawal,
  };
}
