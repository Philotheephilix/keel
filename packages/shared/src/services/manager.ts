/** keel.getOrCreateManager — resolve a user's PredictManager, caching forever. */
import { prisma } from "../db/client.js";
import { getManagersByOwner } from "../indexer/client.js";
import { buildCreateManagerTx } from "../sui/transactions.js";
import { suiClient } from "../sui/client.js";

export type ManagerResult = {
  managerId: string | null;
  needsCreation: boolean;
  /** base64 tx bytes for create_manager, present only when needsCreation. */
  creationTxBytes: string | null;
};

export async function getOrCreateManager(userAddress: string): Promise<ManagerResult> {
  // 1. ledger cache (never changes once known)
  const user = await prisma.keelUser.findUnique({ where: { userAddress } });
  if (user?.predictManagerId) {
    return { managerId: user.predictManagerId, needsCreation: false, creationTxBytes: null };
  }

  // 2. indexer — manager may exist from another Predict app (reusable)
  const existing = (await getManagersByOwner(userAddress))[0]?.manager_id ?? null;
  if (existing) {
    await cacheManager(userAddress, existing);
    return { managerId: existing, needsCreation: false, creationTxBytes: null };
  }

  // 3. none — return an unsigned create_manager tx for the wallet to sign
  const tx = buildCreateManagerTx(userAddress);
  const bytes = await tx.build({ client: suiClient() });
  return {
    managerId: null,
    needsCreation: true,
    creationTxBytes: Buffer.from(bytes).toString("base64"),
  };
}

/** Persist the manager id once known (after creation or discovery). Idempotent. */
export async function cacheManager(userAddress: string, managerId: string): Promise<void> {
  await prisma.keelUser.upsert({
    where: { userAddress },
    create: { userAddress, predictManagerId: managerId },
    update: { predictManagerId: managerId },
  });
}
