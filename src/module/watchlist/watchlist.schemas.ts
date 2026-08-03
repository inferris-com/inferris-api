import z from "zod";

import { BigIntStringSchema } from "@/shared/common.schemas.js";
import { paginationQuerySchema } from "@/shared/pagination.schemas.js";

export const watchlistSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

const subjectSchema = z
  .object({
    subjectActorId: z.guid().optional(),
    subjectPlayerId: z.guid().optional(),
  })
  .refine((body) => Boolean(body.subjectActorId) !== Boolean(body.subjectPlayerId), {
    message: "Provide exactly one of subjectActorId or subjectPlayerId.",
    path: ["subjectActorId"],
  });

export const listWatchlistQuerySchema = paginationQuerySchema
  .extend({
    active: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    subjectActorId: z.guid().optional(),
    subjectPlayerId: z.guid().optional(),
    severity: watchlistSeveritySchema.optional(),
  })
  .strict();

export const getActiveWatchlistQuerySchema = subjectSchema.strict();

export const addWatchlistBodySchema = subjectSchema
  .extend({
    reason: z.string().max(4000).optional().nullable(),
    severity: watchlistSeveritySchema.optional().nullable(),
    alertOnJoin: z.boolean().optional().default(true),
    alertOnChat: z.boolean().optional().default(false),
    alertNote: z.string().max(4000).optional().nullable(),
    expiresAtMs: BigIntStringSchema.optional().nullable(),
  })
  .strict();

export const clearWatchlistBodySchema = subjectSchema
  .extend({
    reason: z.string().max(4000).optional().nullable(),
  })
  .strict();

export type ListWatchlistQuery = z.infer<typeof listWatchlistQuerySchema>;
export type GetActiveWatchlistQuery = z.infer<typeof getActiveWatchlistQuerySchema>;
export type AddWatchlistBody = z.infer<typeof addWatchlistBodySchema>;
export type ClearWatchlistBody = z.infer<typeof clearWatchlistBodySchema>;
