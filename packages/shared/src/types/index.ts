/** Shared domain types + Zod schemas used across web API and keeper. */
import { z } from "zod";

export const SuiAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{1,64}$/, "invalid Sui address");

export const ObjectId = z
  .string()
  .regex(/^0x[0-9a-fA-F]{1,64}$/, "invalid object id");

/** A single binary down-leg of a Keel policy (one MarketKey). */
export const LegSchema = z.object({
  legIndex: z.number().int().nonnegative(),
  type: z.literal("binary"),
  oracleId: ObjectId,
  expiry: z.string(), // u64 as decimal string (ms timestamp)
  strike: z.string(), // u64 as decimal string (9-dec price)
  isUp: z.literal(false), // Keel only mints down-binaries
  quantity: z.string(), // u64 shares as string; max payout == quantity (quote base units)
});
export type Leg = z.infer<typeof LegSchema>;

export const PolicyStatusEnum = z.enum([
  "PENDING_CONFIRM",
  "ACTIVE",
  "EXPIRED_NO_CLAIM",
  "SETTLING",
  "PAID_OUT",
  "FAILED",
]);
/** String form of the status. The runtime enum used by services comes from Prisma (db/client). */
export type PolicyStatusName = z.infer<typeof PolicyStatusEnum>;

export const CoverRequestSchema = z.object({
  oracleId: ObjectId,
  sumInsured: z.number().positive(), // dUSDC, human units
  triggerPrice: z.number().positive(), // human price (e.g. 60000)
  floorPrice: z.number().positive().optional(), // optional explicit floor; else trigger - default band
  rungs: z.number().int().min(1).max(12).optional(),
});
export type CoverRequest = z.infer<typeof CoverRequestSchema>;

export const QuoteLegSchema = LegSchema.extend({
  premium: z.string(), // dUSDC base units
  maxPayout: z.string(), // dUSDC base units (== quantity)
});
export type QuoteLeg = z.infer<typeof QuoteLegSchema>;
