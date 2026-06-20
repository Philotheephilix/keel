/** Route-handler helpers: typed JSON responses + KeelError mapping + BigInt safety. */
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { KeelError } from "@keel/shared";

/** JSON.stringify that survives BigInt (shouldn't occur post-DTO, but defensive). */
function jsonSafe(data: unknown) {
  return JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

export function ok(data: unknown) {
  return NextResponse.json(jsonSafe(data));
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Wrap a handler with uniform error mapping. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ZodError) return fail("BAD_REQUEST", e.issues.map((i) => i.message).join("; "), 422);
    if (e instanceof KeelError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "MARKET_CLOSED" ? 409 : 400;
      return fail(e.code, e.message, status);
    }
    const msg = e instanceof Error ? e.message : "unknown error";
    // surface network reachability distinctly
    if (/fetch|ECONNREFUSED|ENOTFOUND|network/i.test(msg)) {
      return fail("NETWORK", `Can't reach the network right now: ${msg}`, 503);
    }
    return fail("INTERNAL", msg, 500);
  }
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await req.json().catch(() => ({}));
  return schema.parse(body);
}
