import { z } from "zod";
import { getOrCreateManager, cacheManager, SuiAddress, ObjectId } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({ userAddress: SuiAddress, managerId: ObjectId.optional() });

export async function POST(req: Request) {
  return handle(async () => {
    const { userAddress, managerId } = await parseBody(req, Body);
    if (managerId) {
      await cacheManager(userAddress, managerId);
      return { managerId, needsCreation: false, creationTxBytes: null };
    }
    return getOrCreateManager(userAddress);
  });
}
