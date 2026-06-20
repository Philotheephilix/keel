import { z } from "zod";
import { confirmPolicyMinted, SuiAddress, ObjectId, LegSchema } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  userAddress: SuiAddress,
  managerId: ObjectId,
  mintTxDigest: z.string().min(1),
  oracleId: ObjectId,
  underlyingAsset: z.string(),
  expiryTimestamp: z.number().int(),
  triggerPrice: z.number(),
  legs: z.array(LegSchema).min(1),
  sumInsured: z.number(),
  premiumPaid: z.number(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const b = await parseBody(req, Body);
    return confirmPolicyMinted(b);
  });
}
