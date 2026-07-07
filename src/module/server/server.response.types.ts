import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const chatChannelSchema = z.enum(["global", "staff", "testing"]);

export const serverPlayerSummaryResponseSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    flags: z.string(),
    orbs: z.string(),
    chatChannel: chatChannelSchema,
  })
  .openapi("ServerPlayerSummaryResponse");

export const serverResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    type: z.string(),
    environment: z.string(),
    status: z.string(),
    port: z.number().int().nullable(),
    version: z.string(),
    lastStartedAtMs: z.string().nullable(),
    lastHeartbeatAtMs: z.string().nullable(),
    createdAtMs: z.string(),
    lastUpdatedAtMs: z.string().nullable(),
  })
  .openapi("ServerResponse");

export const accessResponseSchema = z
  .object({
    id: z.string().uuid(),
    mode: z.string(),
    requiredPermissionId: z.string().uuid().nullable(),
    requiredRankKey: z.string().nullable(),
    note: z.string().nullable(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("AccessResponse");

export const lockdownResponseSchema = z
  .object({
    id: z.string().uuid(),
    scope: z.string(),
    serverId: z.string().uuid().nullable(),
    requiredRankKey: z.string(),
    reason: z.string(),
    issuedByActorId: z.string().uuid(),
    isActive: z.boolean(),
    startedAtMs: z.string(),
    endsAtMs: z.string().nullable(),
  })
  .openapi("LockdownResponse");

export const playerSessionResponseSchema = z
  .object({
    playerId: z.string().uuid(),
    actorId: z.string().uuid(),
    mojangId: z.string().uuid(),
    serverId: z.string().uuid(),
    sessionEventId: z.string().uuid(),
    token: z.string(),
    expiresAtMs: z.string(),
  })
  .openapi("PlayerSessionResponse");

export const serverHeartbeatResponseSchema = z
  .object({
    refreshedMojangIds: z.array(z.string().uuid()),
    missingMojangIds: z.array(z.string().uuid()),
  })
  .openapi("ServerHeartbeatResponse");

export type ChatChannel = z.infer<typeof chatChannelSchema>;
export type PlayerSummaryResponse = z.infer<typeof serverPlayerSummaryResponseSchema>;
export type ServerResponse = z.infer<typeof serverResponseSchema>;
export type AccessResponse = z.infer<typeof accessResponseSchema>;
export type LockdownResponse = z.infer<typeof lockdownResponseSchema>;
export type PlayerSessionResponse = z.infer<typeof playerSessionResponseSchema>;
export type ServerHeartbeatResponse = z.infer<typeof serverHeartbeatResponseSchema>;
