/**
 * Sui client + keypair helpers. Read paths are used by both web and keeper;
 * the keypair is only ever loaded in the keeper (signs redeem_permissionless).
 */
import { SuiClient, SuiHTTPTransport } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { config, keeperPrivateKey } from "../config.js";
import { retryingFetch } from "../retry.js";

export { retryingFetch };

let _client: SuiClient | null = null;

export function suiClient(): SuiClient {
  if (!_client) {
    _client = new SuiClient({
      transport: new SuiHTTPTransport({ url: config.rpcUrl, fetch: retryingFetch() }),
    });
  }
  return _client;
}

let _keeper: Ed25519Keypair | null = null;

/** Lazily construct the keeper keypair from KEEPER_PRIVATE_KEY (suiprivkey...). */
export function keeperKeypair(): Ed25519Keypair {
  if (!_keeper) {
    const { secretKey } = decodeSuiPrivateKey(keeperPrivateKey());
    _keeper = Ed25519Keypair.fromSecretKey(secretKey);
  }
  return _keeper;
}

export function keeperAddress(): string {
  return keeperKeypair().getPublicKey().toSuiAddress();
}
