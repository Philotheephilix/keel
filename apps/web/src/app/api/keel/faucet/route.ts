import { z } from "zod";
import { claimFaucet, SuiAddress } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Sends 5 dUSDC (once per address) + a small SUI gas stipend if the wallet is low. */
export async function POST(req: Request) {
  return handle(async () => {
    const { userAddress } = await parseBody(req, z.object({ userAddress: SuiAddress }));
    return claimFaucet(userAddress);
  });
}
