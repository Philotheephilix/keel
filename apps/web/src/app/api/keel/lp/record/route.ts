import { z } from "zod";
import { recordLpEvent, SuiAddress } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  userAddress: SuiAddress,
  type: z.enum(["supply", "withdraw"]),
  amountUi: z.number().nonnegative(),
  txDigest: z.string().min(1),
});

export async function POST(req: Request) {
  return handle(async () => {
    const b = await parseBody(req, Body);
    await recordLpEvent(b);
    return { ok: true };
  });
}
