/**
 * Keel Payout Keeper — long-running service. Reactively redeems settled, in-the-money
 * policies via redeem_permissionless (payout lands in each owner's manager). Polls the
 * indexer for settlements (reliable on testnet) and periodically reconciles ledger drift.
 *
 * The ONLY transactions this process signs are redeem_permissionless calls.
 */
import "@keel/shared/loadenv";
import {
  pollSettlements,
  reconcileManagerState,
  keeperAddress,
  keeperKeypair,
  suiClient,
  prisma,
  PolicyStatus,
  type KeeperLog,
} from "@keel/shared";
import { startObservabilityServer } from "./observability/server.js";

const POLL_INTERVAL_MS = Number(process.env.KEEPER_POLL_MS ?? 15_000);
const RECONCILE_EVERY = Number(process.env.KEEPER_RECONCILE_EVERY ?? 8); // every N polls
const OBS_PORT = Number(process.env.KEEPER_OBS_PORT ?? 4000);
const GAS_ALERT_MIST = 50_000_000n; // 0.05 SUI

const log: KeeperLog = (msg, meta) =>
  console.log(`${new Date().toISOString()} [keeper] ${msg}${meta ? " " + JSON.stringify(meta) : ""}`);

let running = true;
let ticks = 0;

async function checkGas(): Promise<void> {
  const bal = await suiClient().getBalance({ owner: keeperAddress() });
  if (BigInt(bal.totalBalance) < GAS_ALERT_MIST) {
    log("⚠️ GAS LOW — keeper wallet needs SUI or payouts will stall", { mist: bal.totalBalance });
  }
}

async function reconcileSweep(): Promise<void> {
  const managers = await prisma.keelPolicy.findMany({
    where: { status: { in: [PolicyStatus.ACTIVE, PolicyStatus.SETTLING] } },
    distinct: ["predictManagerId"],
    select: { predictManagerId: true },
  });
  for (const m of managers) {
    await reconcileManagerState(m.predictManagerId, log).catch((e) =>
      log("reconcile error", { manager: m.predictManagerId, error: (e as Error).message }),
    );
  }
}

async function tick(): Promise<void> {
  ticks++;
  try {
    const processed = await pollSettlements(log);
    if (processed.length > 0) log("processed settlements", { jobs: processed.length });
    if (ticks % RECONCILE_EVERY === 0) await reconcileSweep();
    if (ticks % 4 === 0) await checkGas();
  } catch (e) {
    log("tick error", { error: (e as Error).message });
  }
}

async function main(): Promise<void> {
  // fail fast if signing identity is misconfigured
  const addr = keeperAddress();
  keeperKeypair();
  log("keeper starting", { signer: addr, pollMs: POLL_INTERVAL_MS, obsPort: OBS_PORT });
  await checkGas();
  const obs = startObservabilityServer(OBS_PORT);
  log("observability dashboard", { url: `http://localhost:${OBS_PORT}/` });

  const shutdown = (sig: string) => {
    // Request stop; the loop finishes the in-flight tick before exiting so we never
    // kill the process between a redeem submit and its ledger update.
    log(`received ${sig}, finishing in-flight work then shutting down`);
    running = false;
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  while (running) {
    await tick();
    if (!running) break;
    // interruptible sleep so shutdown isn't delayed a full interval
    for (let i = 0; i < POLL_INTERVAL_MS / 250 && running; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  obs.close();
  log("shutdown complete");
  process.exit(0);
}

main().catch((e) => {
  log("fatal", { error: (e as Error).message });
  process.exit(1);
});
