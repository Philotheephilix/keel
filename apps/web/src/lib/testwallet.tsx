"use client";

/**
 * TEST WALLET — replaces @mysten/dapp-kit for automated end-to-end testing.
 *
 * ⚠️ TESTNET ONLY. It signs with a hardcoded testnet private key
 * (NEXT_PUBLIC_TEST_PRIVATE_KEY) directly in the browser so flows can be driven
 * headlessly with no wallet extension. NEVER ship this with a mainnet key.
 *
 * Exposes the same surface the pages already use from dapp-kit:
 *   useCurrentAccount() -> { address } | null
 *   useSignAndExecuteTransaction() -> { mutateAsync({ transaction }) -> { digest } }
 *   <ConnectButton/>  (shows the active test address)
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { SuiClient, SuiHTTPTransport } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { retryingFetch } from "@keel/shared/retry";

const RPC = process.env.NEXT_PUBLIC_SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443";
const TEST_KEY = process.env.NEXT_PUBLIC_TEST_PRIVATE_KEY ?? "";

type Account = { address: string };
type SignArgs = { transaction: string | Transaction };
type SignResult = { digest: string; effects?: unknown };

type Ctx = {
  account: Account | null;
  client: SuiClient;
  signAndExecute: (args: SignArgs) => Promise<SignResult>;
};

const TestWalletCtx = createContext<Ctx | null>(null);

export function TestWalletProvider({ children }: { children: ReactNode }) {
  const value = useMemo<Ctx>(() => {
    const client = new SuiClient({ transport: new SuiHTTPTransport({ url: RPC, fetch: retryingFetch() }) });
    let account: Account | null = null;
    let keypair: Ed25519Keypair | null = null;
    if (TEST_KEY) {
      try {
        const { secretKey } = decodeSuiPrivateKey(TEST_KEY);
        keypair = Ed25519Keypair.fromSecretKey(secretKey);
        account = { address: keypair.getPublicKey().toSuiAddress() };
      } catch {
        account = null;
      }
    }
    const signAndExecute = async ({ transaction }: SignArgs): Promise<SignResult> => {
      if (!keypair) throw new Error("test wallet key not configured");
      const tx =
        typeof transaction === "string"
          ? Transaction.from(Buffer.from(transaction, "base64"))
          : transaction;
      const res = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true },
      });
      await client.waitForTransaction({ digest: res.digest });
      if (res.effects?.status?.status !== "success") {
        throw new Error(`transaction failed: ${res.effects?.status?.error ?? "unknown"}`);
      }
      return { digest: res.digest, effects: res.effects };
    };
    return { account, client, signAndExecute };
  }, []);

  return <TestWalletCtx.Provider value={value}>{children}</TestWalletCtx.Provider>;
}

function useCtx(): Ctx {
  const ctx = useContext(TestWalletCtx);
  if (!ctx) throw new Error("TestWalletProvider missing");
  return ctx;
}

/** dapp-kit-compatible: returns the active account or null. */
export function useCurrentAccount(): Account | null {
  return useCtx().account;
}

/** dapp-kit-compatible: returns { mutateAsync } that signs + executes. */
export function useSignAndExecuteTransaction() {
  const { signAndExecute } = useCtx();
  return { mutateAsync: signAndExecute, mutate: signAndExecute };
}

/** dapp-kit-compatible ConnectButton: in test mode the account is always present. */
export function ConnectButton() {
  const account = useCurrentAccount();
  const label = account ? `${account.address.slice(0, 6)}…${account.address.slice(-4)}` : "No test key";
  return (
    <span
      data-testid="test-wallet"
      style={{
        background: "var(--accent)",
        color: "#06210f",
        padding: "8px 14px",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 13,
        fontFamily: "ui-monospace, monospace",
      }}
    >
      🧪 {label}
    </span>
  );
}
