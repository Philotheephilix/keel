import { cancelOrRedeemEarly } from "@keel/shared";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await ctx.params;
  return handle(async () => cancelOrRedeemEarly(policyId));
}
