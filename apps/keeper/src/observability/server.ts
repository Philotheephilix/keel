/** Tiny HTTP server exposing keeper state for the demo dashboard. */
import { createServer, type Server } from "node:http";
import { prisma, KeeperJobStatus } from "@keel/shared";

export function startObservabilityServer(port: number): Server {
  const server = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    res.setHeader("access-control-allow-origin", "*");
    try {
      if (req.url?.startsWith("/health")) {
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      const [jobs, recentPolicies] = await Promise.all([
        prisma.keelKeeperJob.findMany({ orderBy: { lastCheckedAt: "desc" }, take: 50 }),
        prisma.keelPolicy.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
      ]);
      res.end(
        JSON.stringify(
          {
            watching: jobs.filter((j) => j.status === KeeperJobStatus.WATCHING).length,
            jobs: jobs.map((j) => ({ id: j.id, oracleId: j.oracleId, status: j.status, attempts: j.attempts, policies: j.policiesToRedeem.length })),
            policies: recentPolicies.map((p) => ({ policyId: p.policyId, status: p.status, asset: p.underlyingAsset, sumInsured: p.sumInsured, payout: p.payoutAmount, redeemTx: p.redeemTxDigest })),
          },
          (_k, v) => (typeof v === "bigint" ? v.toString() : v),
          2,
        ),
      );
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });
  server.listen(port);
  return server;
}
