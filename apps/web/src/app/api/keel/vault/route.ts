import { getVaultSummary } from "@keel/shared";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => getVaultSummary());
}
