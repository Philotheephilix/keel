import { quoteCover, CoverRequestSchema } from "@keel/shared";
import { handle, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Live quote — never cached (it's the number the user is about to pay). */
export async function POST(req: Request) {
  return handle(async () => {
    const reqBody = await parseBody(req, CoverRequestSchema);
    return quoteCover(reqBody);
  });
}
