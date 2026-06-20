import { getPolicyDetail } from "@keel/shared";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await ctx.params;
  return handle(async () => getPolicyDetail(policyId));
}
