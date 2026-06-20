import { z } from "zod";
import { getHoldings, SuiAddress } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const { userAddress } = await parseBody(req, z.object({ userAddress: SuiAddress }));
    return getHoldings(userAddress);
  });
}
