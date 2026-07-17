import z from "zod";

import { BigIntStringSchema } from "../../shared/common.schemas.js";

export const serverInstanceIdParamsSchema = z
  .object({
    serverInstanceId: z.string().guid(),
  })
  .strict();

export const registerServerInstanceBodySchema = z
  .object({
    serverId: z.string().guid(),
    runtimePort: z.int().min(1).max(65535).nullable().optional(),
    version: z.string().max(100).optional(),
    heartbeatIntervalMs: z.int().positive().optional(),
  })
  .strict();

const metricNumberSchema = z.number().finite().min(0);
const metricIntSchema = z.int().min(0);

export const serverInstanceMetricsBodySchema = z
  .object({
    observedAtMs: BigIntStringSchema.optional(),
    onlinePlayerCount: metricIntSchema.optional(),
    maxPlayers: metricIntSchema.optional(),
    tps1m: metricNumberSchema.optional(),
    tps5m: metricNumberSchema.optional(),
    tps15m: metricNumberSchema.optional(),
    msptAvg: metricNumberSchema.optional(),
    msptP95: metricNumberSchema.optional(),
    heapUsedBytes: metricIntSchema.optional(),
    heapMaxBytes: metricIntSchema.optional(),
    loadedChunks: metricIntSchema.optional(),
    loadedWorlds: metricIntSchema.optional(),
    backendServerCount: metricIntSchema.optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const serverInstanceHeartbeatBodySchema = z
  .object({
    observedAtMs: BigIntStringSchema.optional(),
    heartbeatIntervalMs: z.int().positive().optional(),
    runtimePort: z.int().min(1).max(65535).nullable().optional(),
    version: z.string().max(100).optional(),
  })
  .strict();

export const serverInstancePresenceBodySchema = z
  .object({
    observedAtMs: BigIntStringSchema.optional(),
    onlineMojangIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const serverEventTypeSchema = z.enum([
  "SERVER_SHUTTING_DOWN",
  "SERVER_STOPPED",
  "NETWORK_SESSION_STARTED",
  "BACKEND_CONNECTED",
  "NETWORK_SESSION_ENDED",
]);

export const serverInstanceEventBodySchema = z
  .object({
    eventId: z.string().min(1).max(120),
    sequence: z.int().positive(),
    type: serverEventTypeSchema,
    occurredAtMs: BigIntStringSchema.optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type ServerInstanceIdParams = z.infer<typeof serverInstanceIdParamsSchema>;
export type RegisterServerInstanceBody = z.infer<typeof registerServerInstanceBodySchema>;
export type ServerInstanceHeartbeatBody = z.infer<typeof serverInstanceHeartbeatBodySchema>;
export type ServerInstanceMetricsBody = z.infer<typeof serverInstanceMetricsBodySchema>;
export type ServerInstancePresenceBody = z.infer<typeof serverInstancePresenceBodySchema>;
export type ServerInstanceEventBody = z.infer<typeof serverInstanceEventBodySchema>;
export type ServerEventType = z.infer<typeof serverEventTypeSchema>;
