import { z } from "zod";
import { getUserPolicies, SuiAddress, PolicyStatusEnum } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  userAddress: SuiAddress,
  statusFilter: z.array(PolicyStatusEnum).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const { userAddress, statusFilter } = await parseBody(req, Body);
    return { policies: await getUserPolicies(userAddress, statusFilter as any) };
  });
}
