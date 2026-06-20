import { getProtocolStats } from "@keel/shared";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET() {
  return handle(async () => getProtocolStats());
}
