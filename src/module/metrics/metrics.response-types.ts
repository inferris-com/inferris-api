import z from "zod";

import { BigIntStringSchema } from "@/shared/common.schemas.js";

const nullableNumberSchema = z.number().nullable();
const nullableBigIntStringSchema = BigIntStringSchema.nullable();

export const serverMetricSnapshotSchema = z.object({
  serverId: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  environment: z.string(),
  status: z.string(),
  lastHeartbeatAtMs: nullableBigIntStringSchema,
  heartbeatAgeMs: z.number().nullable(),
  isStale: z.boolean(),
  onlinePlayerCount: z.number(),
  reportedOnlinePlayerCount: z.number().nullable(),
  maxPlayers: z.number().nullable(),
  tps1m: nullableNumberSchema,
  tps5m: nullableNumberSchema,
  tps15m: nullableNumberSchema,
  msptAvg: nullableNumberSchema,
  msptP95: nullableNumberSchema,
  heapUsedBytes: nullableBigIntStringSchema,
  heapMaxBytes: nullableBigIntStringSchema,
  loadedChunks: z.number().nullable(),
  loadedWorlds: z.number().nullable(),
  backendServerCount: z.number().nullable(),
});

export const networkMetricBucketSchema = z.object({
  bucketStartMs: BigIntStringSchema,
  joins: z.number(),
  disconnects: z.number(),
  chatMessages: z.number(),
  flaggedChatMessages: z.number(),
});

export const serverMetricBucketSchema = networkMetricBucketSchema.extend({
  onlinePlayerCount: z.number().nullable(),
  tps1m: z.number().nullable(),
  msptAvg: z.number().nullable(),
  heapUsedBytes: BigIntStringSchema.nullable(),
});

export const metricsOverviewResponseSchema = z.object({
  generatedAtMs: BigIntStringSchema,
  window: z.string(),
  current: z.object({
    onlinePlayerCount: z.number(),
    serverCount: z.number(),
    onlineServerCount: z.number(),
    staleServerCount: z.number(),
    averageCompletedSessionSeconds: z.number().nullable(),
  }),
  servers: z.array(serverMetricSnapshotSchema),
  series: z.array(networkMetricBucketSchema),
});

export const serverMetricsResponseSchema = z.object({
  generatedAtMs: BigIntStringSchema,
  window: z.string(),
  server: serverMetricSnapshotSchema,
  series: z.array(serverMetricBucketSchema),
});

export type ServerMetricSnapshot = z.infer<typeof serverMetricSnapshotSchema>;
export type NetworkMetricBucket = z.infer<typeof networkMetricBucketSchema>;
export type ServerMetricBucket = z.infer<typeof serverMetricBucketSchema>;
export type MetricsOverviewResponse = z.infer<typeof metricsOverviewResponseSchema>;
export type ServerMetricsResponse = z.infer<typeof serverMetricsResponseSchema>;
