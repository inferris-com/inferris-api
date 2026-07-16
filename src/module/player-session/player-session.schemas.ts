import z from "zod";

import { paginationQuerySchema } from "../../shared/pagination.schemas.js";

export const playerSessionParamsSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const listPlayerSessionsQuerySchema = paginationQuerySchema
  .extend({
    playerId: z.string().uuid().optional(),
    serverId: z.string().uuid().optional(),
    state: z.enum(["all", "live", "historical"]).default("all"),
  })
  .strict();

export type PlayerSessionParams = z.infer<typeof playerSessionParamsSchema>;
export type ListPlayerSessionsQuery = z.infer<typeof listPlayerSessionsQuerySchema>;
