import { z } from "zod";
import { buildMintTransaction, SuiAddress, ObjectId, LegSchema } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  userAddress: SuiAddress,
  managerId: ObjectId,
  oracleId: ObjectId,
  legs: z.array(LegSchema).min(1),
  totalPremium: z.string(),
  sumInsured: z.number().positive(),
  triggerPrice: z.number().positive(),
  floorPrice: z.number().positive(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const b = await parseBody(req, Body);
    return buildMintTransaction(b);
  });
}
