"use client";

/**
 * Privy-backed Sui wallet — replaces the hardcoded-key test wallet.
 *
 * Privy supports Sui as a Tier-2 "extended chain": users log in (email/social/passkey)
 * and get a Privy-managed embedded Sui wallet. Signing uses the raw-hash endpoint:
 * we build the tx, hash its intent message (blake2b-256), raw-sign that hash, assemble
 * a Sui ED25519 signature, and submit. Exposes the same surface the pages already use:
 *   useCurrentAccount()  -> { address } | null
 *   useSignAndExecuteTransaction() -> { mutateAsync({ transaction }) -> { digest } }
 *   <ConnectButton/>
 *
 * NOTE: a fresh Privy wallet has 0 SUI + 0 dUSDC — fund the address before transacting.
 */
import { useCallback, useEffect } from "react";
import { SuiClient, SuiHTTPTransport } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { messageWithIntent, toSerializedSignature } from "@mysten/sui/cryptography";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { fromB64, toHex } from "@mysten/sui/utils";
import { blake2b } from "@noble/hashes/blake2.js";
import { usePrivy } from "@privy-io/react-auth";
import { useSignRawHash, useCreateWallet } from "@privy-io/react-auth/extended-chains";
import { retryingFetch } from "@keel/shared/retry";

const RPC = process.env.NEXT_PUBLIC_SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443";

let _client: SuiClient | null = null;
function client(): SuiClient {
  if (!_client) _client = new SuiClient({ transport: new SuiHTTPTransport({ url: RPC, fetch: retryingFetch() }) });
  return _client;
}

type SuiWallet = { address: string; publicKey: string };

/** Pull the user's Sui embedded wallet (address + ed25519 public key) from Privy. */
function useSuiWallet(): SuiWallet | null {
  const { user } = usePrivy();
  const accts = (user?.linkedAccounts ?? []) as unknown as Array<Record<string, unknown>>;
  const acct = accts.find(
    (a) => a["type"] === "wallet" && (a["chainType"] === "sui" || a["walletClientType"] === "privy"),
  );
  if (!acct || !acct["address"]) return null;
  const publicKey = (acct["publicKey"] ?? acct["public_key"] ?? "") as string;
  return { address: acct["address"] as string, publicKey };
}

export function useCurrentAccount(): { address: string } | null {
  const w = useSuiWallet();
  return w ? { address: w.address } : null;
}

/** Decode Privy's public key (hex `0x..` or base64) to 32 raw bytes. */
function parsePublicKey(pk: string): Uint8Array {
  if (!pk) throw new Error("Privy wallet has no public key");
  const clean = pk.startsWith("0x") ? pk.slice(2) : pk;
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length === 64) {
    return Uint8Array.from(Buffer.from(clean, "hex"));
  }
  return fromB64(pk);
}

export function useSignAndExecuteTransaction() {
  const w = useSuiWallet();
  const { signRawHash } = useSignRawHash();

  const mutateAsync = useCallback(
    async ({ transaction }: { transaction: string | Transaction }): Promise<{ digest: string; effects?: unknown }> => {
      if (!w) throw new Error("No Sui wallet connected — log in first.");
      const tx = typeof transaction === "string" ? Transaction.from(fromB64(transaction)) : transaction;
      const txBytes = await tx.build({ client: client() });

      // Sui ED25519 signs blake2b-256 of the intent message.
      const intent = messageWithIntent("TransactionData", txBytes);
      const digest = blake2b(intent, { dkLen: 32 });
      const { signature } = await signRawHash({
        address: w.address,
        chainType: "sui",
        hash: ("0x" + toHex(digest)) as `0x${string}`,
      });

      const rawSig = signature.startsWith("0x")
        ? Uint8Array.from(Buffer.from(signature.slice(2), "hex"))
        : fromB64(signature);
      const serialized = toSerializedSignature({
        signature: rawSig,
        signatureScheme: "ED25519",
        publicKey: new Ed25519PublicKey(parsePublicKey(w.publicKey)),
      });

      const res = await client().executeTransactionBlock({
        transactionBlock: txBytes,
        signature: serialized,
        options: { showEffects: true },
      });
      await client().waitForTransaction({ digest: res.digest });
      if (res.effects?.status?.status !== "success") {
        throw new Error(`transaction failed: ${res.effects?.status?.error ?? "unknown"}`);
      }
      return { digest: res.digest, effects: res.effects };
    },
    [w, signRawHash],
  );

  return { mutateAsync, mutate: mutateAsync };
}

export function ConnectButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const w = useSuiWallet();

  // Ensure a Sui embedded wallet exists once the user is authenticated.
  useEffect(() => {
    if (authenticated && !w) {
      createWallet({ chainType: "sui" }).catch(() => {});
    }
  }, [authenticated, w, createWallet]);

  const btn = (label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      data-testid="privy-wallet"
      style={{
        background: "var(--accent)",
        color: "#06210f",
        padding: "8px 14px",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 13,
        border: "none",
        cursor: "pointer",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      {label}
    </button>
  );

  if (!ready) return btn("…", () => {});
  if (!authenticated) return btn("Connect wallet", () => login());
  const label = w ? `${w.address.slice(0, 6)}…${w.address.slice(-4)}` : "Creating wallet…";
  return btn(label, () => logout());
}
