import { z } from "zod";
import { buildSupplyTransaction, SuiAddress } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const { userAddress, amount } = await parseBody(
      req,
      z.object({ userAddress: SuiAddress, amount: z.number().positive() }),
    );
    return buildSupplyTransaction(userAddress, amount);
  });
}
