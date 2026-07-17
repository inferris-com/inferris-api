import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type { Json } from "../../db/types.js";

extendZodWithOpenApi(z);

export const backendSessionSummarySchema = z.object({
  id: z.string().uuid(),
  backendServerId: z.string().uuid(),
  backendServerName: z.string(),
  backendServerInstanceId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  joinedAtMs: z.string(),
  leftAtMs: z.string().nullable(),
  leaveReason: z.string().nullable(),
  meta: z.any(),
  updatedAtMs: z.string().nullable(),
});

export const playerSessionResponseSchema = z
  .object({
    id: z.string().uuid(),
    playerId: z.string().uuid(),
    playerUsername: z.string(),
    playerMojangId: z.string().uuid(),
    actorId: z.string().uuid(),
    proxyServerId: z.string().uuid(),
    proxyServerName: z.string(),
    currentBackendServerId: z.string().uuid().nullable(),
    currentBackendServerName: z.string().nullable(),
    currentBackendSessionId: z.string().uuid().nullable(),
    isLive: z.boolean(),
    connectedAtMs: z.string(),
    disconnectedAtMs: z.string().nullable(),
    disconnectReason: z.string().nullable(),
    meta: z.any(),
    updatedAtMs: z.string().nullable(),
    backendSessions: z.array(backendSessionSummarySchema).optional(),
  })
  .openapi("NetworkSessionDetailsResponse");

export type BackendSessionSummary = {
  id: string;
  backendServerId: string;
  backendServerName: string;
  backendServerInstanceId: string | null;
  isActive: boolean;
  joinedAtMs: string;
  leftAtMs: string | null;
  leaveReason: string | null;
  meta: Json;
  updatedAtMs: string | null;
};

export type PlayerSessionResponse = {
  id: string;
  playerId: string;
  playerUsername: string;
  playerMojangId: string;
  actorId: string;
  proxyServerId: string;
  proxyServerName: string;
  currentBackendServerId: string | null;
  currentBackendServerName: string | null;
  currentBackendSessionId: string | null;
  isLive: boolean;
  connectedAtMs: string;
  disconnectedAtMs: string | null;
  disconnectReason: string | null;
  meta: Json;
  updatedAtMs: string | null;
  backendSessions?: BackendSessionSummary[];
};
