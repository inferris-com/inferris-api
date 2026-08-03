import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { BigIntStringSchema } from "@/shared/common.schemas.js";

extendZodWithOpenApi(z);

export const serverInstanceIdParamsSchema = z
  .object({
    serverInstanceId: z.string().guid(),
  })
  .strict();

export const registerServerInstanceBodySchema = z
  .object({
    serverId: z.string().guid(),
    bootId: z.string().min(1).max(120),
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
    snapshotSequence: z.int().positive(),
    onlineMojangIds: z.array(z.string().guid()).optional(),
  })
  .strict();

const emptyPayloadSchema = z.object({}).strict();
const playerPayloadSchema = z
  .object({
    playerId: z.string().guid().optional(),
    actorId: z.string().guid().optional(),
    mojangId: z.string().guid(),
    username: z.string().min(1).max(32),
  })
  .strict();
const networkSessionStartedPayloadSchema = playerPayloadSchema
  .extend({
    networkSessionId: z.string().guid(),
  })
  .strict();
const backendConnectedPayloadSchema = z
  .object({
    networkSessionId: z.string().guid(),
    backendServerId: z.string().guid(),
    backendServerInstanceId: z.string().guid().nullable().optional(),
  })
  .strict();
const networkSessionEndedPayloadSchema = z
  .object({
    networkSessionId: z.string().guid(),
  })
  .strict();

const serverEventBaseSchema = z.object({
  eventId: z.string().min(1).max(120),
  sequence: z.int().positive(),
  occurredAtMs: BigIntStringSchema,
});

function eventTypeLiteral<T extends ServerEventType>(type: T) {
  return z.literal(type).openapi({ type: "string" });
}

export const networkSessionStartedEventRequestSchema = serverEventBaseSchema
  .extend({
    type: eventTypeLiteral("NETWORK_SESSION_STARTED"),
    payload: networkSessionStartedPayloadSchema,
  })
  .strict()
  .openapi("NetworkSessionStartedEventRequest");

export const backendConnectedEventRequestSchema = serverEventBaseSchema
  .extend({
    type: eventTypeLiteral("BACKEND_CONNECTED"),
    payload: backendConnectedPayloadSchema,
  })
  .strict()
  .openapi("BackendConnectedEventRequest");

export const networkSessionEndedEventRequestSchema = serverEventBaseSchema
  .extend({
    type: eventTypeLiteral("NETWORK_SESSION_ENDED"),
    payload: networkSessionEndedPayloadSchema,
  })
  .strict()
  .openapi("NetworkSessionEndedEventRequest");

export const serverShuttingDownEventRequestSchema = serverEventBaseSchema
  .extend({
    type: eventTypeLiteral("SERVER_SHUTTING_DOWN"),
    payload: emptyPayloadSchema,
  })
  .strict()
  .openapi("ServerShuttingDownEventRequest");

export const serverStoppedEventRequestSchema = serverEventBaseSchema
  .extend({
    type: eventTypeLiteral("SERVER_STOPPED"),
    payload: emptyPayloadSchema,
  })
  .strict()
  .openapi("ServerStoppedEventRequest");

export const serverInstanceEventBodySchema = z
  .discriminatedUnion("type", [
    networkSessionStartedEventRequestSchema,
    backendConnectedEventRequestSchema,
    networkSessionEndedEventRequestSchema,
    serverShuttingDownEventRequestSchema,
    serverStoppedEventRequestSchema,
  ])
  .openapi("ServerInstanceEventRequest");

export const serverEventTypeSchema = z.enum([
  "SERVER_SHUTTING_DOWN",
  "SERVER_STOPPED",
  "NETWORK_SESSION_STARTED",
  "BACKEND_CONNECTED",
  "NETWORK_SESSION_ENDED",
]);

export type ServerInstanceIdParams = z.infer<typeof serverInstanceIdParamsSchema>;
export type RegisterServerInstanceBody = z.infer<typeof registerServerInstanceBodySchema>;
export type ServerInstanceHeartbeatBody = z.infer<typeof serverInstanceHeartbeatBodySchema>;
export type ServerInstanceMetricsBody = z.infer<typeof serverInstanceMetricsBodySchema>;
export type ServerInstancePresenceBody = z.infer<typeof serverInstancePresenceBodySchema>;
export type ServerInstanceEventBody = z.infer<typeof serverInstanceEventBodySchema>;
export type ServerEventType = z.infer<typeof serverEventTypeSchema>;
