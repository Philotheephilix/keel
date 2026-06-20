/**
 * Testnet dUSDC faucet — sends 5 dUSDC per address (once), plus a small SUI gas stipend
 * if the recipient is too low on gas to transact. Signed server-side by the funding
 * wallet (KEEPER_PRIVATE_KEY). One claim per address, enforced by a unique ledger row.
 */
import { Transaction } from "@mysten/sui/transactions";
import { config } from "../config.js";
import { suiClient, keeperKeypair, keeperAddress } from "../sui/client.js";
import { signAndExecute } from "../sui/execute.js";
import { prisma } from "../db/client.js";
import { KeelError } from "./quote.js";

const DUSDC_AMOUNT = 5_000_000n; // 5 dUSDC (6 decimals)
const SUI_STIPEND = 50_000_000n; // 0.05 SUI (9 decimals) — a few transactions' worth of gas
const SUI_GAS_THRESHOLD = 20_000_000n; // top up gas only if recipient holds < 0.02 SUI
const FAUCET_GAS_BUDGET = 80_000_000n; // multi-command PTB (merge + 1-2 splits + 1-2 transfers)

export type FaucetResult = { txDigest: string; dusdc: number; sui: number };

export async function claimFaucet(userAddress: string): Promise<FaucetResult> {
  // Reserve the claim FIRST so funds can never be sent twice: the @unique constraint
  // makes a concurrent or repeat claim fail here, before any transfer happens.
  try {
    await prisma.keelFaucetClaim.create({
      data: { userAddress, txDigest: "pending", dusdc: 5, sui: 0 },
    });
  } catch {
    throw new KeelError("ALREADY_CLAIMED", "This address already claimed test dUSDC. One claim per address.");
  }

  let sendSui = false;
  let res;
  try {
    const funding = keeperAddress();
    const { data } = await suiClient().getCoins({ owner: funding, coinType: config.quoteAssetType });
    const total = data.reduce((s, c) => s + BigInt(c.balance), 0n);
    if (total < DUSDC_AMOUNT) throw new KeelError("FAUCET_EMPTY", "Faucet is out of dUSDC.");

    const recipientSui = BigInt((await suiClient().getBalance({ owner: userAddress })).totalBalance);
    sendSui = recipientSui < SUI_GAS_THRESHOLD;

    const tx = new Transaction();
    tx.setSender(funding);
    tx.setGasBudget(FAUCET_GAS_BUDGET);

    const sorted = [...data].sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
    const primary = tx.object(sorted[0]!.coinObjectId);
    if (sorted.length > 1) {
      tx.mergeCoins(primary, sorted.slice(1).map((c) => tx.object(c.coinObjectId)));
    }
    const [dusdcOut] = tx.splitCoins(primary, [tx.pure.u64(DUSDC_AMOUNT)]);
    tx.transferObjects([dusdcOut], userAddress);
    if (sendSui) {
      const [suiOut] = tx.splitCoins(tx.gas, [tx.pure.u64(SUI_STIPEND)]);
      tx.transferObjects([suiOut], userAddress);
    }

    res = await signAndExecute(tx, keeperKeypair());
  } catch (e) {
    // failure before the transfer landed — release the reservation so the user can retry.
    await prisma.keelFaucetClaim.delete({ where: { userAddress } }).catch(() => {});
    throw e;
  }

  // Funds have landed. NEVER roll back from here — recording the digest is best-effort,
  // so a DB hiccup can't reopen the claim and cause a double-spend (fail-closed).
  await prisma.keelFaucetClaim
    .update({ where: { userAddress }, data: { txDigest: res.digest, sui: sendSui ? 0.05 : 0 } })
    .catch(() => {});
  return { txDigest: res.digest, dusdc: 5, sui: sendSui ? 0.05 : 0 };
}
