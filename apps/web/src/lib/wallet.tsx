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
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
  // Strict: only a Sui wallet. Matching `walletClientType === 'privy'` would also pick up
  // an EVM/Solana embedded wallet, whose address/key are not Sui and would break signing.
  const acct = accts.find((a) => a["type"] === "wallet" && a["chainType"] === "sui");
  if (!acct || !acct["address"]) return null;
  const publicKey = (acct["publicKey"] ?? acct["public_key"] ?? "") as string;
  return { address: acct["address"] as string, publicKey };
}

export function useCurrentAccount(): { address: string } | null {
  const w = useSuiWallet();
  return w ? { address: w.address } : null;
}

/** Decode Privy's public key (hex `0x..` or base64) to the 32-byte ED25519 key. */
function parsePublicKey(pk: string): Uint8Array {
  if (!pk) throw new Error("Privy wallet has no public key");
  const clean = pk.startsWith("0x") ? pk.slice(2) : pk;
  // hex: decode the cleaned (un-prefixed) string, then trim an optional leading scheme flag.
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
    const bytes = Uint8Array.from(Buffer.from(clean, "hex"));
    if (bytes.length === 32) return bytes;
    if (bytes.length === 33) return bytes.slice(1); // strip ED25519 flag byte
  }
  // base64 (decode the original string, not the 0x-stripped one)
  const b = fromB64(pk);
  return b.length === 33 ? b.slice(1) : b;
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

const pill: CSSProperties = {
  background: "var(--accent)",
  color: "#06210f",
  padding: "8px 14px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
  border: "none",
  cursor: "pointer",
  fontFamily: "ui-monospace, monospace",
};
const ghost: CSSProperties = {
  background: "transparent",
  color: "var(--text)",
  padding: "8px 10px",
  borderRadius: 8,
  fontSize: 13,
  border: "1px solid var(--border)",
  cursor: "pointer",
};

export function ConnectButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const w = useSuiWallet();
  const creating = useRef(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Ensure a Sui embedded wallet exists once authenticated. Guarded against re-firing,
  // and creation errors are surfaced instead of swallowed.
  useEffect(() => {
    if (authenticated && !w && !creating.current) {
      creating.current = true;
      createWallet({ chainType: "sui" })
        .catch((e) => setCreateError(e instanceof Error ? e.message : "could not create wallet"))
        .finally(() => {
          creating.current = false;
        });
    }
  }, [authenticated, w, createWallet]);

  async function copy() {
    if (!w) return;
    try {
      await navigator.clipboard.writeText(w.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (!ready) return <button style={pill}>…</button>;
  if (!authenticated)
    return (
      <button data-testid="privy-wallet" style={pill} onClick={() => login()}>
        Connect wallet
      </button>
    );

  if (!w) {
    return (
      <button data-testid="privy-wallet" style={pill} onClick={() => logout()} title={createError ?? ""}>
        {createError ? "Wallet error — disconnect" : "Creating wallet…"}
      </button>
    );
  }

  return (
    <div data-testid="privy-wallet" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={pill} onClick={copy} title={w.address}>
        {copied ? "Copied ✓" : `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}
      </button>
      <button style={ghost} onClick={copy} title="Copy address" aria-label="Copy address">
        ⧉
      </button>
      <button style={ghost} onClick={() => logout()} title="Disconnect" aria-label="Disconnect">
        ⏻
      </button>
    </div>
  );
}
