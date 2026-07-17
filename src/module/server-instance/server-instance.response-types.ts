import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const serverInstanceResponseSchema = z
  .object({
    id: z.string().guid(),
    serverId: z.string().guid(),
    state: z.string(),
    runtimePort: z.number().int().nullable(),
    version: z.string().nullable(),
    startedAtMs: z.string(),
    drainingAtMs: z.string().nullable(),
    stoppedAtMs: z.string().nullable(),
    lostAtMs: z.string().nullable(),
    supersededAtMs: z.string().nullable(),
    lastHeartbeatAtMs: z.string().nullable(),
    heartbeatIntervalMs: z.string().nullable(),
    lastEventSequence: z.string(),
    isSyntheticBackfill: z.boolean(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("ServerInstanceResponse");

export const registerServerInstanceResponseSchema = serverInstanceResponseSchema
  .extend({
    token: z.string(),
  })
  .openapi("RegisterServerInstanceResponse");

export const serverInstanceHeartbeatResponseSchema = z
  .object({
    serverInstanceId: z.string().guid(),
    state: z.string(),
    lastHeartbeatAtMs: z.string(),
  })
  .openapi("ServerInstanceHeartbeatResponse");

export const serverInstancePresenceResponseSchema = z
  .object({
    serverInstanceId: z.string().guid(),
    observedAtMs: z.string(),
    observedPlayerCount: z.number().int(),
  })
  .openapi("ServerInstancePresenceResponse");

export const serverInstanceMetricsResponseSchema = z
  .object({
    serverInstanceId: z.string().guid(),
    observationId: z.string().guid(),
    observedAtMs: z.string(),
  })
  .openapi("ServerInstanceMetricsResponse");

export const serverInstanceEventResponseSchema = z
  .object({
    serverInstanceId: z.string().guid(),
    eventId: z.string(),
    sequence: z.string(),
    type: z.string(),
    idempotent: z.boolean(),
  })
  .openapi("ServerInstanceEventResponse");

export type ServerInstanceResponse = z.infer<typeof serverInstanceResponseSchema>;
export type RegisterServerInstanceResponse = z.infer<typeof registerServerInstanceResponseSchema>;
export type ServerInstanceHeartbeatResponse = z.infer<
  typeof serverInstanceHeartbeatResponseSchema
>;
export type ServerInstancePresenceResponse = z.infer<typeof serverInstancePresenceResponseSchema>;
export type ServerInstanceMetricsResponse = z.infer<typeof serverInstanceMetricsResponseSchema>;
export type ServerInstanceEventResponse = z.infer<typeof serverInstanceEventResponseSchema>;
