import { z } from "zod";
import { getOracleState, listInsurableOracles, ObjectId } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET -> list insurable oracles. */
export async function GET() {
  return handle(async () => ({ oracles: await listInsurableOracles() }));
}

/** POST { oracleId, forceFresh? } -> single oracle state. */
export async function POST(req: Request) {
  return handle(async () => {
    const { oracleId, forceFresh } = await parseBody(
      req,
      z.object({ oracleId: ObjectId, forceFresh: z.boolean().optional() }),
    );
    return getOracleState(oracleId, { forceFresh });
  });
}
