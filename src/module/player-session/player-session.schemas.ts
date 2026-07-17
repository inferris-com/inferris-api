import z from "zod";

import { paginationQuerySchema } from "../../shared/pagination.schemas.js";

export const networkSessionParamsSchema = z
  .object({
    networkSessionId: z.string().guid(),
  })
  .strict();

export const listPlayerSessionsQuerySchema = paginationQuerySchema
  .extend({
    playerId: z.string().guid().optional(),
    serverId: z.string().guid().optional(),
    proxyServerId: z.string().guid().optional(),
    backendServerId: z.string().guid().optional(),
    state: z.enum(["all", "active", "completed"]).default("all"),
    fromMs: z.coerce.string().regex(/^\d+$/).optional(),
    toMs: z.coerce.string().regex(/^\d+$/).optional(),
    include: z.enum(["backendSessions"]).optional(),
    cursor: z.string().optional(),
  })
  .strict();

export const getPlayerSessionQuerySchema = z
  .object({
    include: z.enum(["backendSessions"]).optional(),
  })
  .strict();

export type NetworkSessionParams = z.infer<typeof networkSessionParamsSchema>;
export type ListPlayerSessionsQuery = z.infer<typeof listPlayerSessionsQuerySchema>;
export type GetPlayerSessionQuery = z.infer<typeof getPlayerSessionQuerySchema>;
