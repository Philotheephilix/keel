/** Sign + execute helpers (keeper / scripts only — the web never signs). */
import type { Transaction } from "@mysten/sui/transactions";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { SuiTransactionBlockResponse } from "@mysten/sui/client";
import { suiClient } from "./client.js";

export async function signAndExecute(
  tx: Transaction,
  signer: Ed25519Keypair,
): Promise<SuiTransactionBlockResponse> {
  const res = await suiClient().signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true, showObjectChanges: true, showEvents: true },
  });
  await suiClient().waitForTransaction({ digest: res.digest });
  // A tx that executes but ABORTS on-chain still returns a digest — treat that as a
  // failure so callers never record success on an aborted transaction.
  const status = res.effects?.status?.status;
  if (status !== "success") {
    throw new Error(`tx ${res.digest} did not succeed: ${res.effects?.status?.error ?? status}`);
  }
  return res;
}

/** Pull the created PredictManager id from a create_manager tx's object changes. */
export function managerIdFromChanges(res: SuiTransactionBlockResponse): string | null {
  for (const ch of res.objectChanges ?? []) {
    if (ch.type === "created" && ch.objectType.endsWith("::predict_manager::PredictManager")) {
      return ch.objectId;
    }
  }
  return null;
}
