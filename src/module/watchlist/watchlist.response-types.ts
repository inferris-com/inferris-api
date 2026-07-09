import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const watchlistEntryResponseSchema = z
  .object({
    id: z.number().int().nonnegative(),
    subjectActorId: z.string().uuid(),
    subjectPlayerId: z.string().uuid().nullable(),
    subjectUsername: z.string().nullable(),
    addedByActorId: z.string().uuid(),
    reason: z.string().nullable(),
    severity: z.enum(["low", "medium", "high", "critical"]).nullable(),
    alertOnJoin: z.boolean(),
    alertOnChat: z.boolean(),
    alertNote: z.string().nullable(),
    expiresAtMs: z.string().nullable(),
    clearedByActorId: z.string().uuid().nullable(),
    clearedAtMs: z.string().nullable(),
    addedAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("WatchlistEntryResponse");

export type WatchlistEntryResponse = z.infer<typeof watchlistEntryResponseSchema>;
