import { z } from "zod";
import { buildWithdrawTransaction, SuiAddress } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const { userAddress, plpAmount } = await parseBody(
      req,
      z.object({ userAddress: SuiAddress, plpAmount: z.number().positive() }),
    );
    return buildWithdrawTransaction(userAddress, plpAmount);
  });
}
